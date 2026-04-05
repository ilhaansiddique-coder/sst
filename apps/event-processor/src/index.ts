import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { createClient } from "@clickhouse/client";
import Redis from "ioredis";
import { randomUUID, createHash } from "node:crypto";
import geoip from "geoip-lite";
import { UAParser } from "ua-parser-js";

import { eventLogRecordSchema, trackingEventSchema, type EventLogRecordInput } from "@sst/shared";

import { getProcessorEnv } from "./env";
import { loadEnv } from "./load-env";

loadEnv();

/* ---------- Constants ---------- */

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const DEDUPE_WINDOW_SECONDS = 60 * 60 * 24;
const RATE_LIMIT_PER_SECOND = 5000;
const USAGE_KEY_TTL_SECONDS = 60 * 60 * 24 * 120;
const CONTAINER_CACHE_TTL_SECONDS = 60 * 5;

/* ---------- Environment & services ---------- */

const env = getProcessorEnv();
const app = Fastify({ logger: true });
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  lazyConnect: true,
});
const clickhouse = createClient({
  url: env.CLICKHOUSE_URL,
  username: env.CLICKHOUSE_USER,
  password: env.CLICKHOUSE_PASSWORD,
});

const port = env.PORT;
const apiBaseUrl = env.API_URL.replace(/\/$/, "");

app.register(fastifyCors, { origin: true });

app.addHook("onClose", async () => {
  await Promise.all([redis.quit(), clickhouse.close()]);
});

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function toIsoTimestamp(value: string | number | undefined): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  return new Date().toISOString();
}

function toClickHouseDateTime(
  value: string,
  precision: "seconds" | "milliseconds" = "milliseconds",
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp provided for ClickHouse insert: ${value}`);
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  if (precision === "seconds") {
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

function toApiInternalUrl(baseUrl: string): string {
  return baseUrl.endsWith("/api") ? `${baseUrl}/events/internal` : `${baseUrl}/api/events/internal`;
}

function toUsageMonth(timestamp: string): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getClientIp(rawIp?: string): string {
  if (!rawIp) return "0.0.0.0";
  const normalized = rawIp.replace("::ffff:", "");
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(normalized) ? normalized : "0.0.0.0";
}

function toHeaderValue(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

function toPropertiesRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readStringProperty(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized.length > 0) return normalized;
    }
  }
  return undefined;
}

function parseCookieHeader(rawCookieHeader?: string | string[]): Record<string, string> {
  const cookieHeader = toHeaderValue(rawCookieHeader);
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce<Record<string, string>>((cookies, part) => {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) return cookies;
    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (name.length > 0 && value.length > 0) cookies[name] = value;
    return cookies;
  }, {});
}

function buildFbcFromPageUrl(pageUrl?: string, timestamp?: string): string | undefined {
  if (!pageUrl) return undefined;
  try {
    const url = new URL(pageUrl);
    const fbclid = url.searchParams.get("fbclid");
    if (!fbclid) return undefined;
    const eventTimestamp = timestamp ? new Date(timestamp).getTime() : Date.now();
    const safeTimestamp = Number.isNaN(eventTimestamp) ? Date.now() : eventTimestamp;
    return `fb.1.${safeTimestamp}.${fbclid}`;
  } catch {
    return undefined;
  }
}

/* ============================================================
   PIPELINE STEP 1: RECEIVE — extract basic request context
   ============================================================ */

// (handled inline in route handlers below)

/* ============================================================
   PIPELINE STEP 2: VALIDATE — schema + container auth + quota
   ============================================================ */

interface ContainerConfig {
  id: string;
  accountId: string;
  name: string;
  eventQuota: number;
  region: string;
}

async function resolveContainerConfig(containerId: string): Promise<ContainerConfig | null> {
  if (!containerId || containerId === ZERO_UUID) return null;

  // Check Redis cache first
  const cached = await redis.get(`sst:container:${containerId}`);
  if (cached) return JSON.parse(cached) as ContainerConfig;

  // Cache miss — query API to resolve (or return null)
  // For now we allow events without container binding
  return null;
}

async function checkAccountQuota(accountId: string, month: string): Promise<{ allowed: boolean; usage: number; quota: number }> {
  if (!accountId || accountId === ZERO_UUID) return { allowed: true, usage: 0, quota: Infinity };

  const key = `sst:usage:${accountId}:${month}`;
  const usageStr = await redis.hget(key, "total");
  const usage = Number(usageStr) || 0;

  // Check quota from account cache
  const accountData = await redis.get(`sst:account:${accountId}:quota`);
  const quota = accountData ? Number(accountData) : 500_000; // default hobby plan

  return { allowed: usage < quota, usage, quota };
}

/* ============================================================
   PIPELINE STEP 3: DEDUPLICATE — Redis SETNX with 24h TTL
   ============================================================ */

async function deduplicate(eventId: string, containerId?: string): Promise<boolean> {
  const dedupeKey = `${eventId}:${containerId ?? "dev"}`;
  const isNew = await redis.set(`sst:dedupe:${dedupeKey}`, "1", "EX", DEDUPE_WINDOW_SECONDS, "NX");
  return isNew !== null;
}

/* ============================================================
   PIPELINE STEP 4: ENRICH — geo-IP, user-agent, cookies
   ============================================================ */

interface EnrichmentResult {
  country: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  deviceType: string;
  os: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
  properties: Record<string, unknown>;
}

function enrichEvent(options: {
  ip: string;
  userAgent?: string;
  properties?: unknown;
  pageUrl?: string;
  timestamp?: string;
  cookieHeader?: string | string[];
}): EnrichmentResult {
  // Geo-IP enrichment
  const geo = geoip.lookup(options.ip);

  // User-Agent parsing with ua-parser-js
  const ua = new UAParser(options.userAgent ?? "");
  const device = ua.getDevice();
  const os = ua.getOS();
  const browser = ua.getBrowser();
  const deviceType = device.type === "mobile" || device.type === "tablet"
    ? device.type
    : "desktop";

  // Cookie & fbp/fbc enrichment
  const properties = toPropertiesRecord(options.properties);
  const cookies = parseCookieHeader(options.cookieHeader);
  const fbp = readStringProperty(properties, ["fbp", "_fbp"]) ?? cookies._fbp;
  const fbc =
    readStringProperty(properties, ["fbc", "_fbc"]) ??
    cookies._fbc ??
    buildFbcFromPageUrl(options.pageUrl, options.timestamp);

  const enrichedProperties: Record<string, unknown> = {
    ...properties,
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
  };

  return {
    country: geo?.country ?? "",
    city: geo?.city ?? "",
    region: geo?.region ?? "",
    latitude: geo?.ll?.[0] ?? 0,
    longitude: geo?.ll?.[1] ?? 0,
    deviceType,
    os: os.name ?? "unknown",
    osVersion: os.version ?? "",
    browser: browser.name ?? "unknown",
    browserVersion: browser.version ?? "",
    properties: enrichedProperties,
  };
}

/* ============================================================
   PIPELINE STEP 5: HASH PII — SHA256 before storage/forwarding
   ============================================================ */

function normalizeForHashing(value: string, mode: "email" | "phone" | "text"): string {
  const trimmed = value.trim();
  if (mode === "email") return trimmed.toLowerCase();
  if (mode === "phone") return trimmed.replace(/[\s\-()]+/g, "");
  return trimmed.toLowerCase().replace(/\s+/g, "");
}

function hashIfNotAlreadyHashed(value: string): string {
  // If already a 64-char hex string (SHA256), return as-is
  if (/^[a-f0-9]{64}$/i.test(value)) return value.toLowerCase();
  return sha256Hex(value);
}

function hashPiiInProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const result = { ...properties };
  const piiFields: Array<{ keys: string[]; mode: "email" | "phone" | "text"; outputKey: string }> = [
    { keys: ["email", "em"], mode: "email", outputKey: "em_hashed" },
    { keys: ["phone", "ph"], mode: "phone", outputKey: "ph_hashed" },
    { keys: ["first_name", "firstName", "fn"], mode: "text", outputKey: "fn_hashed" },
    { keys: ["last_name", "lastName", "ln"], mode: "text", outputKey: "ln_hashed" },
  ];

  for (const field of piiFields) {
    const raw = readStringProperty(result as Record<string, unknown>, field.keys);
    if (raw) {
      const normalized = normalizeForHashing(raw, field.mode);
      result[field.outputKey] = hashIfNotAlreadyHashed(normalized);
      // Delete raw PII — never store or forward unhashed
      for (const key of field.keys) {
        if (key in result) delete result[key];
      }
    }
  }

  return result;
}

/* ============================================================
   PIPELINE STEP 6: ROUTE — forward to API for destination delivery
   ============================================================ */

async function forwardEventToApi(event: EventLogRecordInput) {
  const response = await fetch(toApiInternalUrl(apiBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!response.ok) {
    throw new Error(`Failed to forward event log (${response.status})`);
  }
}

/* ============================================================
   PIPELINE STEP 7: LOG — ClickHouse persistence + Redis counters
   ============================================================ */

async function persistEvent(event: EventLogRecordInput, enrichment: EnrichmentResult) {
  await clickhouse.insert({
    table: "tracking.events",
    format: "JSONEachRow",
    values: [
      {
        event_id: event.eventId,
        account_id: event.accountId ?? ZERO_UUID,
        container_id: event.containerId ?? ZERO_UUID,
        event_name: event.eventName,
        event_time: toClickHouseDateTime(event.timestamp, "milliseconds"),
        client_id: event.clientId,
        session_id: event.sessionId ?? "",
        ip: getClientIp(event.ip),
        country: enrichment.country,
        city: enrichment.city,
        device_type: enrichment.deviceType,
        os: enrichment.os,
        browser: enrichment.browser,
        page_url: event.pageUrl ?? "",
        referrer: event.referrer ?? "",
        utm_source: "",
        utm_medium: "",
        utm_campaign: "",
        revenue: event.revenue ?? 0,
        currency: event.currency,
        properties: JSON.stringify(event.properties ?? {}),
        destinations: event.destinations,
        status: event.status,
        server_time: toClickHouseDateTime(event.receivedAt, "seconds"),
      },
    ],
  });
}

async function incrementRealtimeUsage(event: EventLogRecordInput) {
  if (!event.accountId) return;
  const key = `sst:usage:${event.accountId}:${toUsageMonth(event.timestamp)}`;
  const pipeline = redis.pipeline();
  pipeline.hincrby(key, "total", 1);
  if (event.destinations.includes("meta")) pipeline.hincrby(key, "meta", 1);
  if (event.destinations.includes("tiktok")) pipeline.hincrby(key, "tiktok", 1);
  if (event.destinations.includes("google") || event.destinations.includes("ga4")) {
    pipeline.hincrby(key, "google", 1);
  }
  pipeline.expire(key, USAGE_KEY_TTL_SECONDS);
  await pipeline.exec();
}

/* ============================================================
   RATE LIMITER
   ============================================================ */

async function enforceRateLimit(ip: string): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 1000);
  const key = `sst:ratelimit:ingest:${ip}:${bucket}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 2);
  return count <= RATE_LIMIT_PER_SECOND;
}

/* ============================================================
   FULL PIPELINE — orchestrates all 7 steps
   ============================================================ */

async function runPipeline(options: {
  rawBody: unknown;
  ip: string;
  userAgent?: string;
  cookieHeader?: string | string[];
}): Promise<{ status: number; body: Record<string, unknown> }> {
  // Step 1: Receive — parse raw body
  const parsed = trackingEventSchema.safeParse(options.rawBody);
  if (!parsed.success) {
    return {
      status: 400,
      body: { accepted: false, reason: "validation_failed", issues: parsed.error.flatten() },
    };
  }

  const event = parsed.data;
  const eventId = event.eventId ?? randomUUID();
  const timestamp = toIsoTimestamp(event.timestamp);

  // Step 2: Validate — rate limit
  const withinRateLimit = await enforceRateLimit(options.ip);
  if (!withinRateLimit) {
    return { status: 429, body: { accepted: false, reason: "rate_limited" } };
  }

  // Step 2b: Validate — quota check
  if (event.accountId) {
    const month = toUsageMonth(timestamp);
    const quota = await checkAccountQuota(event.accountId, month);
    if (!quota.allowed) {
      return {
        status: 429,
        body: { accepted: false, reason: "quota_exceeded", usage: quota.usage, quota: quota.quota },
      };
    }
  }

  // Step 3: Deduplicate
  const isUnique = await deduplicate(eventId, event.containerId);
  if (!isUnique) {
    return { status: 202, body: { accepted: false, reason: "duplicate", eventId } };
  }

  // Step 4: Enrich — geo-IP, user-agent, cookies
  const enrichment = enrichEvent({
    ip: options.ip,
    userAgent: event.userAgent ?? options.userAgent,
    properties: event.properties,
    pageUrl: event.pageUrl,
    timestamp,
    cookieHeader: options.cookieHeader,
  });

  // Step 5: Hash PII
  const hashedProperties = hashPiiInProperties(enrichment.properties);

  // Build the normalized event log record
  const normalizedEvent: EventLogRecordInput = eventLogRecordSchema.parse({
    ...event,
    eventId,
    timestamp,
    ip: event.ip ?? options.ip,
    userAgent: event.userAgent ?? options.userAgent,
    properties: hashedProperties,
    status: "processed",
    source: "processor",
    receivedAt: new Date().toISOString(),
  });

  // Step 6 & 7: Persist, count, route — in parallel where possible
  try {
    await persistEvent(normalizedEvent, enrichment);
    await incrementRealtimeUsage(normalizedEvent);
    await forwardEventToApi(normalizedEvent);
  } catch (error) {
    app.log.error({ error, eventId }, "Failed to fully process event");
    return { status: 500, body: { accepted: false, reason: "processing_failed", eventId } };
  }

  return {
    status: 202,
    body: {
      accepted: true,
      eventId,
      routedDestinations: normalizedEvent.destinations,
      storedIn: "clickhouse",
      apiSynchronized: true,
    },
  };
}

/* ============================================================
   ROUTES
   ============================================================ */

// Health check
app.get("/health", async () => {
  const [redisStatus, clickhouseStatus] = await Promise.all([
    redis.ping(),
    clickhouse.ping(),
  ]);

  return {
    status: "ok",
    service: "sst-event-processor",
    checkedAt: new Date().toISOString(),
    dependencies: {
      redis: redisStatus,
      clickhouse: clickhouseStatus.success ? "ok" : "error",
    },
  };
});

// Main event ingest endpoint
app.post("/events/ingest", async (request, reply) => {
  const result = await runPipeline({
    rawBody: request.body,
    ip: getClientIp(request.ip),
    userAgent: toHeaderValue(request.headers["user-agent"]),
    cookieHeader: request.headers.cookie,
  });

  return reply.status(result.status).send(result.body);
});

/**
 * sGTM Google Analytics 4 collector (mimic)
 * Accepts requests in the same format as Google's /g/collect endpoint.
 * When a real sGTM is running, nginx routes /g/collect to sGTM instead.
 * This serves as a fallback collector for direct-to-processor setups.
 */
app.all("/g/collect", async (request, reply) => {
  const query = request.query as Record<string, string>;
  const eventName = query.en || "page_view";
  const clientId = query.cid || query._cid || "anonymous";

  const result = await runPipeline({
    rawBody: {
      eventName,
      clientId,
      sessionId: query.sid,
      pageUrl: query.dl,
      referrer: query.dr,
      ip: getClientIp(request.ip),
      userAgent: toHeaderValue(request.headers["user-agent"]),
      destinations: ["ga4", "meta"],
      properties: { ...query, source: "sgtm_mimic" },
    },
    ip: getClientIp(request.ip),
    userAgent: toHeaderValue(request.headers["user-agent"]),
    cookieHeader: request.headers.cookie,
  });

  // GTM expects 204 regardless of outcome
  return reply.status(204).send();
});

/**
 * GA4 Measurement Protocol proxy
 */
app.post("/mp/collect", async (request, reply) => {
  const body = request.body as any;

  if (!body.events || !Array.isArray(body.events)) {
    return reply.status(400).send({ error: "No events provided" });
  }

  for (const gaEvent of body.events) {
    await runPipeline({
      rawBody: {
        eventName: gaEvent.name,
        clientId: body.client_id,
        sessionId: gaEvent.params?.session_id,
        pageUrl: gaEvent.params?.page_location,
        ip: getClientIp(request.ip),
        userAgent: toHeaderValue(request.headers["user-agent"]),
        destinations: ["ga4"],
        properties: { ...gaEvent.params, source: "mp_proxy" },
      },
      ip: getClientIp(request.ip),
      userAgent: toHeaderValue(request.headers["user-agent"]),
      cookieHeader: request.headers.cookie,
    });
  }

  return reply.status(204).send();
});

// Sample event for testing
app.get("/events/sample", async () => ({
  eventId: randomUUID(),
  eventName: "purchase",
  clientId: "client_123",
  pageUrl: "https://shop.example.com/checkout/success",
  currency: "USD",
  revenue: 129.99,
  destinations: ["meta", "ga4"],
}));

/* ============================================================
   BOOTSTRAP
   ============================================================ */

async function bootstrap(): Promise<void> {
  await redis.connect();
  await redis.ping();
  await app.listen({ port, host: "0.0.0.0" });
}

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
