import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { createClient } from "@clickhouse/client";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";

import { eventLogRecordSchema, trackingEventSchema, type EventLogRecordInput } from "@sst/shared";

import { getProcessorEnv } from "./env";
import { loadEnv } from "./load-env";

loadEnv();

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const DEDUPE_WINDOW_SECONDS = 60 * 60 * 24;
const RATE_LIMIT_PER_SECOND = 5000;
const USAGE_KEY_TTL_SECONDS = 60 * 60 * 24 * 120;

const env = getProcessorEnv();
const app = Fastify({ logger: true });
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
});
const clickhouse = createClient({
  url: env.CLICKHOUSE_URL,
});

const port = env.PORT;
const apiBaseUrl = env.API_URL.replace(/\/$/, "");

app.register(fastifyCors, {
  origin: true,
});

app.addHook("onClose", async () => {
  await Promise.all([redis.quit(), clickhouse.close()]);
});

function toIsoTimestamp(value: string | number | undefined): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return new Date(value).toISOString();
  }

  return new Date().toISOString();
}

function toApiInternalUrl(baseUrl: string): string {
  return baseUrl.endsWith("/api") ? `${baseUrl}/events/internal` : `${baseUrl}/api/events/internal`;
}

function toUsageMonth(timestamp: string): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getClientIp(rawIp?: string): string {
  if (!rawIp) {
    return "0.0.0.0";
  }

  const normalized = rawIp.replace("::ffff:", "");
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(normalized) ? normalized : "0.0.0.0";
}

function inferDevice(userAgent?: string): { deviceType: string; os: string; browser: string } {
  const normalized = userAgent?.toLowerCase() ?? "";
  const deviceType = /mobile|iphone|android/.test(normalized) ? "mobile" : "desktop";
  const os = normalized.includes("windows")
    ? "windows"
    : normalized.includes("mac os")
      ? "macos"
      : normalized.includes("android")
        ? "android"
        : normalized.includes("iphone") || normalized.includes("ios")
          ? "ios"
          : normalized.includes("linux")
            ? "linux"
            : "unknown";
  const browser = normalized.includes("edg")
    ? "edge"
    : normalized.includes("chrome")
      ? "chrome"
      : normalized.includes("firefox")
        ? "firefox"
        : normalized.includes("safari")
          ? "safari"
          : "unknown";

  return { deviceType, os, browser };
}

async function enforceRateLimit(ip: string): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 1000);
  const key = `sst:ratelimit:ingest:${ip}:${bucket}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 1);
  }

  return count <= RATE_LIMIT_PER_SECOND;
}

async function forwardEventToApi(event: EventLogRecordInput) {
  const response = await fetch(toApiInternalUrl(apiBaseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error(`Failed to forward event log (${response.status})`);
  }
}

async function incrementRealtimeUsage(event: EventLogRecordInput) {
  if (!event.accountId) {
    return;
  }

  const key = `sst:usage:${event.accountId}:${toUsageMonth(event.timestamp)}`;
  const pipeline = redis.pipeline();

  pipeline.hincrby(key, "total", 1);

  if (event.destinations.includes("meta")) {
    pipeline.hincrby(key, "meta", 1);
  }

  if (event.destinations.includes("tiktok")) {
    pipeline.hincrby(key, "tiktok", 1);
  }

  if (event.destinations.includes("google") || event.destinations.includes("ga4")) {
    pipeline.hincrby(key, "google", 1);
  }

  pipeline.expire(key, USAGE_KEY_TTL_SECONDS);
  await pipeline.exec();
}

async function persistEvent(event: EventLogRecordInput) {
  const device = inferDevice(event.userAgent);

  await clickhouse.insert({
    table: "tracking.events",
    format: "JSONEachRow",
    values: [
      {
        event_id: event.eventId,
        account_id: event.accountId ?? ZERO_UUID,
        container_id: event.containerId ?? ZERO_UUID,
        event_name: event.eventName,
        event_time: event.timestamp,
        client_id: event.clientId,
        session_id: event.sessionId ?? "",
        ip: getClientIp(event.ip),
        country: "",
        city: "",
        device_type: device.deviceType,
        os: device.os,
        browser: device.browser,
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
        server_time: event.receivedAt,
      },
    ],
  });
}

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

app.post("/events/ingest", async (request, reply) => {
  const withinRateLimit = await enforceRateLimit(getClientIp(request.ip));

  if (!withinRateLimit) {
    return reply.status(429).send({
      accepted: false,
      reason: "rate_limited",
    });
  }

  const parsed = trackingEventSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({
      message: "Invalid event payload.",
      issues: parsed.error.flatten(),
    });
  }

  const event = parsed.data;
  const eventId = event.eventId ?? randomUUID();
  const dedupeKey = `${eventId}:${event.containerId ?? "dev"}`;
  const isUnique = await redis.set(`sst:dedupe:${dedupeKey}`, "1", "EX", DEDUPE_WINDOW_SECONDS, "NX");

  if (!isUnique) {
    return reply.status(202).send({
      accepted: false,
      reason: "duplicate",
      eventId,
    });
  }

  const normalizedEvent: EventLogRecordInput = eventLogRecordSchema.parse({
    ...event,
    eventId,
    timestamp: toIsoTimestamp(event.timestamp),
    ip: event.ip ?? getClientIp(request.ip),
    status: "processed",
    source: "processor",
    receivedAt: new Date().toISOString(),
  });

  let apiSynchronized = true;

  try {
    await persistEvent(normalizedEvent);
    await incrementRealtimeUsage(normalizedEvent);
    await forwardEventToApi(normalizedEvent);
  } catch (error) {
    apiSynchronized = false;
    request.log.error({ error, eventId }, "Failed to fully process event");

    return reply.status(500).send({
      accepted: false,
      reason: "processing_failed",
      eventId,
    });
  }

  return reply.status(202).send({
    accepted: true,
    eventId,
    routedDestinations: normalizedEvent.destinations,
    storedIn: "clickhouse",
    apiSynchronized,
  });
});

app.get("/events/sample", async () => ({
  eventId: randomUUID(),
  eventName: "purchase",
  clientId: "client_123",
  pageUrl: "https://shop.example.com/checkout/success",
  currency: "USD",
  revenue: 129.99,
  destinations: ["meta", "ga4"],
}));

app
  .listen({
    port,
    host: "0.0.0.0",
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
