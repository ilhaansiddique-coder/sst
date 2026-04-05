SST PLATFORM

DEVELOPMENT GUIDE

Phase-by-Phase Blueprint for Building a Server-Side Tracking Platform

What to Build  •  How to Build It  •  Why It Works

Every concept explained so you can describe it in an interview

Combined from: Blueprint Document + Practical Recommendations

April 2026

Table of Contents

# Phase 0: Understanding Server-Side Tracking

Before writing any code, you need a crystal-clear mental model of what you are building and why it exists. This phase is about understanding, not coding.

## 0.1 The Problem: Why Client-Side Tracking Is Dying

When someone visits a website today, JavaScript tracking scripts (Meta Pixel, Google tag, TikTok Pixel) run directly in the user’s browser. Each script sends data to its respective platform. This approach is broken for three reasons:

- Ad blockers: 30-40% of users have ad blockers that completely prevent tracking scripts from loading. Meta/Google never see these users.
- Safari ITP (Intelligent Tracking Prevention): Apple’s Safari limits client-side cookies to 7 days (or 24 hours if set by JavaScript). A user who visits on Monday and buys on the following Tuesday is invisible.
- iOS 14.5+ App Tracking Transparency: Users must opt-in to tracking. Over 85% opt out. Facebook lost visibility into billions of dollars of conversions.

The result: ad platforms only see 50-70% of actual conversions. Advertisers think their ads perform worse than they do, make bad decisions, and waste money. This is a $100B+ problem.

Why this matters: This is why your platform will make money. Businesses are desperate to recover their lost conversion data. Server-side tracking solves this because ad blockers cannot block requests to the business’s own domain.

## 0.2 The Solution: Server-Side Tracking

Instead of the browser talking directly to Meta/Google/TikTok, the browser talks to YOUR server (running on the client’s own subdomain). Your server then talks to all the ad platforms via their server-to-server APIs.

The key insight: When the tracking request goes to data.theirshop.com (the client’s own domain), the browser treats it as a first-party request. Ad blockers don’t block it. Safari gives it full cookie access (400 days). iOS doesn’t restrict it.

Interview answer: Server-side tracking moves the data collection point from the user’s browser to a server you control. The browser sends one request to a first-party subdomain. The server enriches that data with information the browser can’t provide, like geo-location and device fingerprinting, then fans it out to every ad platform via their Conversions APIs. This bypasses ad blockers, extends cookie lifetime, and recovers 30-40% of lost conversions.

## 0.3 What Is sGTM (Server-Side Google Tag Manager)?

Important: You do NOT build sGTM from scratch. Google provides it as a Docker image. You HOST it.

sGTM is a Node.js application that Google maintains and publishes as a Docker container image. When you start this container with a configuration string (your GTM Container ID), it runs a tag processing engine that:

- Receives HTTP requests from the website (via the GTM web container)
- Processes tags, triggers, and variables (configured in the GTM UI at tagmanager.google.com)
- Forwards events to destinations like GA4, Meta CAPI, TikTok Events API

Think of it like WordPress. WordPress is free open-source software anyone can download. Companies like Kinsta and WP Engine charge money to host it, manage the infrastructure, and add premium features. That’s exactly what Stape.io does with sGTM — and what you’re building.

Interview answer: sGTM is Google’s official server-side tag processing engine, distributed as a Docker image. I don’t write the tag engine — I host it. My platform automates provisioning a container for each customer, assigns a custom domain with SSL, adds enrichment features Google doesn’t provide (like extended cookies and geo-IP), and wraps it all in a dashboard with billing.

## 0.4 The Two Products You Can Build

There are two distinct products, and you should build them in order:

### Product A: CAPI Gateway (Build This First)

A simplified integration where the customer’s website sends events directly to your server via a plugin or script, and your server forwards to Meta/Google/TikTok. No sGTM involved. Much simpler to build, faster to market, and addresses the biggest pain point (Meta CAPI).

Why this matters: This is what Stape calls their “Gateway” product. It’s simpler because you control both the data format and the routing. The customer just installs a plugin and enters their API tokens. You can ship this in 4-6 weeks.

### Product B: sGTM Hosting (Add Later)

Full hosting of Google’s sGTM container. The customer configures everything in Google’s Tag Manager UI. You provide the infrastructure, custom domains, and power-ups. This requires Kubernetes orchestration and is significantly more complex, but it’s the premium product.

Interview answer: I built the platform in two phases. First, I launched a CAPI Gateway product — a simpler integration where our server receives events directly and forwards them to ad platform APIs. This let me ship fast and learn the Meta/Google/TikTok APIs. Then I added full sGTM hosting as a premium tier, where I provision and manage Google’s official server-side GTM containers for each customer.

# Phase 1: Project Foundation

This phase sets up the monorepo, databases, and authentication. You’ve already completed most of this.

## 1.1 Monorepo Structure

The project uses npm workspaces to manage three applications and one shared package in a single repository:

```text
Project structure
SST/
├─ apps/
│  ├─ frontend/        ← Next.js 14 (customer dashboard + marketing site)
│  ├─ api/             ← NestJS 10 (REST API for dashboard operations)
│  └─ event-processor/ ← Fastify (receives and routes tracking events)
├─ packages/
│  └─ shared/          ← TypeScript types, Zod schemas, constants
├─ db/                ← SQL init scripts for Postgres + ClickHouse
├─ infra/             ← nginx config, Kubernetes manifests
├─ docker-compose.yml ← Local development databases
└─ package.json       ← Root workspace config
```

### Why three separate services?

- API (NestJS at :3001): Handles authentication, CRUD operations, billing, and configuration. Used by the dashboard. Doesn’t need to be fast — needs to be correct and secure.
- Event Processor (Fastify at :3002): Handles tracking events. Needs to be extremely fast (sub-100ms response time). Fastify is ~2x faster than Express/NestJS for raw HTTP throughput.
- Frontend (Next.js at :3000): Server-rendered React app. Marketing pages are public, dashboard pages require authentication.

Interview answer: I separated the API from the event processor because they have completely different performance requirements. The API handles dashboard operations — CRUD, auth, billing — where correctness matters more than speed. The event processor handles tracking events at high throughput, so I used Fastify which benchmarks at 70k+ requests/second. They share TypeScript types through a workspace package.

## 1.2 Three Databases — Each for a Different Job

Using three databases is not over-engineering. Each one solves a problem the others can’t:

| Database | Type | What it stores | Why this one |
| --- | --- | --- | --- |
| PostgreSQL 16 | Relational (OLTP) | Users, accounts, containers, gateway configs, subscriptions, billing | ACID transactions, row-level security for multi-tenancy, Prisma ORM support, mature ecosystem |
| Redis 7 | In-memory cache | Sessions, deduplication hashes, rate limits, usage counters, real-time KV store | Sub-millisecond reads. A dedup check in PostgreSQL takes 2-5ms; in Redis it takes 0.1ms. At 1000 events/second, that difference is critical |
| ClickHouse | Columnar (OLAP) | Event logs, analytics data, time-series metrics | Can store billions of rows. Aggregation queries (count events per day) run 100x faster than PostgreSQL. Designed for append-heavy write patterns |

Interview answer: I use PostgreSQL for transactional data like users and billing because it gives me ACID compliance and row-level security for tenant isolation. Redis handles the real-time hot path — deduplication, rate limiting, session caching — where I need sub-millisecond latency. ClickHouse is my analytics engine for storing billions of tracking events with fast aggregation for the dashboard charts.

## 1.3 Authentication System

Your auth system is already working. Here’s what each piece does and why:

```text
apps/api/src/auth/auth.service.ts — What happens at each step
// POST /api/auth/register
async register(email: string, password: string) {
  // Step 1: Hash the password (never store plaintext)
  const hash = await bcrypt.hash(password, 12);
  // WHY bcrypt? It's intentionally slow (~250ms per hash),
  // making brute-force attacks impractical. 12 rounds = 2^12 iterations.

  // Step 2: Create the account (tenant) in PostgreSQL
  const account = await prisma.account.create({
    data: { name: email.split('@')[0], plan: 'hobby', event_quota: 500000 }
  });
  // WHY separate account from user? Multi-tenancy. An account is a company.
  // Multiple users can belong to one account (owner, admin, member).

  // Step 3: Create the user linked to the account
  const user = await prisma.user.create({
    data: { email, password_hash: hash, account_id: account.id, role: 'owner' }
  });

  // Step 4: Generate tokens
  const accessToken = jwt.sign(
    { sub: user.id, accountId: account.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }   // Short-lived: if stolen, limited damage
  );
  const refreshToken = jwt.sign(
    { sub: user.id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }    // Long-lived: stored securely, used to get new access tokens
  );

  return { accessToken, refreshToken, user };
}
```

Why this matters: Short-lived access tokens (15 min) + long-lived refresh tokens (7 days) is the industry standard. If an access token is stolen (e.g., from browser memory), it expires quickly. The refresh token is stored as an httpOnly cookie, so JavaScript can’t access it.

## 1.4 Container Management (CRUD)

A “container” in your platform represents one customer’s tracking setup. When they create a container, they get:

- A unique endpoint where their website sends tracking events
- A configuration specifying which platforms to forward events to (Meta, Google, TikTok)
- Usage tracking counting events per month against their plan quota

Status: You have the container CRUD endpoints working. The containers table stores account_id, name, gtm_id, custom_domain, region, status, and a JSONB config field.

# Phase 2: The Event Pipeline (Heart of the Platform)

This is the most important phase. The event pipeline is what makes your platform actually DO something. Everything before this was scaffolding. This phase builds the core product.

## 2.1 Overview: What the Event Pipeline Does

When a tracking event arrives from a customer’s website, it passes through a 7-step pipeline. Think of it like an assembly line in a factory — each station does one job:

| Step | Name | What it does | Why it’s needed |
| --- | --- | --- | --- |
| 1 | Receive | Accept the HTTP request at POST /collect | Entry point — the website’s data arrives here |
| 2 | Validate | Check auth token, verify schema, check quota | Reject invalid/unauthorized requests before wasting resources |
| 3 | Deduplicate | Hash the event ID, check Redis if seen before | Browsers sometimes send the same event twice. Meta charges for duplicate conversions |
| 4 | Enrich | Add geo-IP, parse user-agent, extend cookies | Adds data the browser can’t provide. Higher data quality = better ad targeting = happy customers |
| 5 | Hash PII | SHA256 hash email and phone number | Meta/Google require hashed PII for matching. GDPR compliance — you never store raw PII |
| 6 | Route | Send to Meta CAPI, Google, TikTok in parallel with automatic retries | The actual delivery — this is what the customer is paying for |
| 7 | Log | Write the event plus every delivery attempt to ClickHouse + increment Redis counters | Powers the dashboard (logs, analytics) and billing (usage metering)Important reliability requirement: if a destination call fails, the platform should retry it automatically 3-5 times with short exponential backoff before marking the delivery as failed. Every attempt must be logged so the dashboard can show the full delivery lifecycle. |

## 2.2 Step 1: Receive — The /collect Endpoint

This is the door. Every tracking event enters through a single HTTP endpoint on the event processor:

```text
apps/event-processor/src/routes/collect.ts
import { FastifyInstance } from 'fastify';
import { pipeline } from '../pipeline';

export async function collectRoutes(app: FastifyInstance) {
  // This is the endpoint that customer websites send events to
  // URL: POST https://data.customerdomain.com/collect
  app.post('/collect', async (request, reply) => {
    // The request body contains the tracking event
    // It comes from the GTM web container or your JS snippet
    const rawEvent = request.body as RawTrackingEvent;

    // Pass through the pipeline
    const result = await pipeline.process({
      ...rawEvent,
      ip: request.ip,                          // Client IP from the request
      userAgent: request.headers['user-agent'], // Browser info
      receivedAt: Date.now(),
    });

    // Return quickly — the browser is waiting
    // 204 = "I received it, nothing to send back"
    return reply.code(204).send();
  });
}

// WHAT THE INCOMING EVENT LOOKS LIKE:
// This is what GTM or your snippet sends to /collect
interface RawTrackingEvent {
  event_name: string;       // "purchase", "page_view", "add_to_cart"
  event_id: string;         // Unique ID for deduplication
  container_token: string;  // Identifies which customer this belongs to
  timestamp: number;        // When the event happened (Unix ms)
  page_url: string;         // "https://theirshop.com/checkout/thanks"
  referrer?: string;        // Where they came from

  // E-commerce data (only for purchase/add_to_cart events)
  ecommerce?: {
    transaction_id: string;
    value: number;          // 149.99
    currency: string;       // "SEK"
    items: Array<{ item_name: string; quantity: number; price: number }>;
  };

  // User identifiers (for matching across platforms)
  user_data?: {
    email?: string;         // Will be SHA256 hashed before sending anywhere
    phone?: string;         // Will be normalized to E.164 then hashed
  };

  // Cookies the browser has access to
  cookies?: {
    _fbp?: string;  // Meta browser cookie (identifies user to Facebook)
    _fbc?: string;  // Meta click ID (from Facebook ad click)
    _ga?: string;   // Google Analytics client ID
    ttclid?: string; // TikTok click ID
  };
}
```

Interview answer: The /collect endpoint is the single entry point for all tracking events. It’s deliberately minimal — accept the request, extract the IP and user-agent from headers, pass to the pipeline, return 204 immediately. The browser should never wait for the pipeline to complete; I fire-and-forget the downstream processing.

## 2.3 Step 2: Validate — Is This Request Legitimate?

```text
apps/event-processor/src/pipeline/validate.ts
import { z } from 'zod';
import { redis } from '../lib/redis';

// Zod schema — defines the EXACT shape a valid event must have
const EventSchema = z.object({
  event_name: z.string().min(1).max(100),
  event_id: z.string().min(1),
  container_token: z.string().min(20),
  timestamp: z.number().positive(),
  page_url: z.string().url(),
  ip: z.string(),
  userAgent: z.string(),
  ecommerce: z.object({
    transaction_id: z.string(),
    value: z.number(),
    currency: z.string().length(3),
    items: z.array(z.object({ item_name: z.string(), quantity: z.number() })),
  }).optional(),
  user_data: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }).optional(),
  cookies: z.record(z.string()).optional(),
});

export async function validate(raw: unknown) {
  // STEP A: Schema validation — is the data shaped correctly?
  const parsed = EventSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid event: ${parsed.error.message}`);
    // WHY throw? Bad data should fail fast. Don't waste Redis/DB resources.
  }

  const event = parsed.data;

  // STEP B: Authentication — does this container token belong to a real customer?
  // We cache container configs in Redis for speed (avoids DB query per event)
  const containerConfig = await redis.get(`container:${event.container_token}`);
  if (!containerConfig) {
    // Cache miss — check PostgreSQL
    // If not found there either, this is an unauthorized request
    throw new Error('Invalid container token');
  }

  const config = JSON.parse(containerConfig);

  // STEP C: Quota check — has this customer used up their monthly events?
  const month = new Date().toISOString().slice(0, 7); // "2026-04"
  const usage = await redis.get(`usage:${config.account_id}:${month}`);
  if (Number(usage) >= config.event_quota) {
    throw new Error('Event quota exceeded');
    // Customer needs to upgrade their plan
  }

  return { event, config };
}
```

Why this matters: Validation happens FIRST because it’s the cheapest operation. If the data is malformed or the token is invalid, we reject immediately without touching Redis for dedup, ClickHouse for storage, or external APIs for delivery. At 1000 events/second, rejecting bad requests early saves enormous resources.

## 2.4 Step 3: Deduplicate — Prevent Double-Counting

```text
apps/event-processor/src/pipeline/deduplicate.ts
import { createHash } from 'crypto';
import { redis } from '../lib/redis';

export async function deduplicate(event: ValidatedEvent): Promise<boolean> {
  // Create a unique fingerprint for this event
  // Same event_id + same container = definitely a duplicate
  const hash = createHash('sha256')
    .update(event.event_id + event.container_token)
    .digest('hex')
    .substring(0, 16);  // First 16 chars is enough (collision chance: ~1 in 10^19)

  // Redis SETNX = "Set if Not eXists"
  // Returns true if the key was NEW (not a duplicate)
  // Returns false if the key already existed (IS a duplicate)
  const isNew = await redis.set(
    `dedup:${hash}`,
    '1',
    'EX', 86400,  // Expires after 24 hours
    'NX'          // Only set if key doesn't exist
  );

  // WHY 24 hours? Browser retries typically happen within seconds/minutes.
  // 24h covers edge cases like page refreshes and back-button revisits.
  // After 24h, even if the same event somehow fires again, it's probably
  // a new session and should be counted.

  return isNew !== null; // true = new event, false = duplicate
}

// HOW DUPLICATES HAPPEN:
// 1. Browser sends event, network timeout, retries automatically
// 2. User refreshes the thank-you page (purchase fires again)
// 3. Both GTM web container AND your snippet send the same event
// 4. Mobile app backgrounded and resumed (re-fires events)
//
// WITHOUT dedup: Meta sees 2 purchases of $149.99 = $299.98 reported
// WITH dedup: Meta sees 1 purchase of $149.99 = correct reporting
```

## 2.5 Step 4: Enrich — Add Server-Side Data

```text
apps/event-processor/src/pipeline/enrich.ts
import geoip from 'geoip-lite';     // Free MaxMind GeoLite2 database
import { UAParser } from 'ua-parser-js';

export function enrich(event: ValidatedEvent): EnrichedEvent {
  // ENRICHMENT 1: Geo-IP lookup
  // The browser can't reliably tell you where the user is.
  // But we have their IP address from the HTTP request.
  const geo = geoip.lookup(event.ip);
  // geo = { country: 'SE', region: 'M', city: 'Helsingborg', ll: [56.05, 12.7] }

  // WHY this matters: Meta's Event Match Quality (EMQ) score goes UP
  // when you include geo data. Higher EMQ = better ad targeting = higher ROAS.

  // ENRICHMENT 2: User-Agent parsing
  // The raw UA string is "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4...)"
  // We parse it into structured data
  const ua = new UAParser(event.userAgent);
  const device = {
    type: ua.getDevice().type || 'desktop',  // mobile, tablet, desktop
    os: ua.getOS().name,                      // iOS, Android, Windows
    browser: ua.getBrowser().name,             // Safari, Chrome, Firefox
    os_version: ua.getOS().version,            // 17.4
    browser_version: ua.getBrowser().version,  // 17.3
  };

  // WHY this matters: Ad platforms use device data for audience segmentation.
  // "Show this ad to iPhone users in Sweden" requires knowing the device.

  // ENRICHMENT 3: Session stitching from server-side cookies
  // If we've seen this user before (via our server-set cookie),
  // we can link this event to their previous visits
  // This is what extends the 7-day Safari limit to 400 days

  return {
    ...event,
    geo: geo ? {
      country: geo.country,   // "SE"
      region: geo.region,     // "M"  (Skåne)
      city: geo.city,         // "Helsingborg"
      latitude: geo.ll?.[0],
      longitude: geo.ll?.[1],
    } : undefined,
    device,
  };
}
```

## 2.6 Step 5: Hash PII — Privacy Compliance

```text
apps/event-processor/src/pipeline/hash-pii.ts
import { createHash } from 'crypto';

// SHA256 hash — one-way function, can't be reversed
function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

// Phone normalization to E.164 format
// "+46 70-123 45 67" → "+46701234567" → sha256 hash
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '');  // Strip spaces, dashes, parens
}

export function hashPII(event: EnrichedEvent): HashedEvent {
  const hashed = { ...event, user_data_hashed: {} as Record<string, string> };

  if (event.user_data?.email) {
    // IMPORTANT: lowercase + trim before hashing
    // "John@Example.com" and "john@example.com" must produce the SAME hash
    // Otherwise Meta can't match the user
    const normalized = event.user_data.email.toLowerCase().trim();
    hashed.user_data_hashed.em = sha256(normalized);
  }

  if (event.user_data?.phone) {
    const normalized = normalizePhone(event.user_data.phone);
    hashed.user_data_hashed.ph = sha256(normalized);
  }

  // DELETE the raw PII — we never store or forward unhashed data
  delete hashed.user_data;

  return hashed;
}

// WHY SHA256 HASHING?
// 1. GDPR compliance: you never store raw emails/phones on your servers
// 2. Meta/Google REQUIRE hashed identifiers in their server-to-server APIs
// 3. The ad platforms have their own user databases with the same hashes
//    When hash from you = hash in their DB, they "match" the user
//    This is how they attribute the conversion to the right ad click
//
// EXAMPLE:
// Your server sends:  em = "a1b2c3d4e5..." (SHA256 of "customer@example.com")
// Meta has stored:    em = "a1b2c3d4e5..." (SHA256 of the same email from login)
// MATCH! Meta knows this conversion came from the Facebook ad they clicked.
```

Interview answer: I hash all personally identifiable information with SHA256 before it leaves my server. This is both a GDPR compliance requirement and a technical requirement from the ad platforms. Meta’s Conversions API requires SHA256-hashed email and phone for user matching. I normalize the data first — lowercase email, E.164 phone format — because the same input must always produce the same hash for matching to work.

# Phase 3: Platform Integrations (Where the Money Is)

This phase builds the destination services that actually send events to Meta, Google, and TikTok. Each platform has its own API, authentication method, and data format. Your event processor normalizes the data and translates it into each platform’s specific format.

## 3.1 Meta Conversions API (CAPI)

Meta CAPI is the most important integration because Facebook/Instagram advertising is the largest use case. Here’s exactly how it works:

### How the customer connects Meta

In your dashboard, the customer enters two things:

- Pixel ID: A number like 123456789012345. Found in Facebook Events Manager.
- Access Token: A long string starting with “EAA...”. Generated in Facebook Business Settings.

Your API encrypts these credentials and stores them in PostgreSQL (the gateway_configs table). The event processor reads them when routing events.

### How your server sends to Meta

```text
apps/event-processor/src/destinations/meta.ts
// Meta Conversions API endpoint:
// POST https://graph.facebook.com/v19.0/{PIXEL_ID}/events
// Authorization via access_token query parameter

interface MetaServerEvent {
  event_name: string;       // "Purchase", "AddToCart", "PageView"
  event_time: number;       // Unix timestamp in SECONDS (not ms!)
  event_id: string;         // For dedup between browser pixel + server
  event_source_url: string; // Page where the event happened
  action_source: 'website'; // Always "website" for web tracking
  user_data: {
    em?: string[];   // Array of SHA256 hashed emails
    ph?: string[];   // Array of SHA256 hashed phones
    client_ip_address: string;
    client_user_agent: string;
    fbp?: string;    // _fbp cookie value (Meta browser ID)
    fbc?: string;    // _fbc cookie value (Facebook click ID)
    country?: string[];  // ISO country code, lowercase, hashed
    ct?: string[];       // City name, lowercase, hashed
  };
  custom_data?: {
    value?: number;
    currency?: string;
    order_id?: string;
    content_type?: string;
    contents?: Array<{ id: string; quantity: number }>;
  };
}

export async function sendToMeta(event: HashedEvent, config: MetaGatewayConfig) {
  const serverEvent: MetaServerEvent = {
    event_name: mapEventName(event.event_name),
    event_time: Math.floor(event.timestamp / 1000), // Meta wants seconds!
    event_id: event.event_id,
    event_source_url: event.page_url,
    action_source: 'website',
    user_data: {
      em: event.user_data_hashed.em ? [event.user_data_hashed.em] : undefined,
      ph: event.user_data_hashed.ph ? [event.user_data_hashed.ph] : undefined,
      client_ip_address: event.ip,
      client_user_agent: event.userAgent,
      fbp: event.cookies?._fbp,
      fbc: event.cookies?._fbc,
    },
    custom_data: event.ecommerce ? {
      value: event.ecommerce.value,
      currency: event.ecommerce.currency,
      order_id: event.ecommerce.transaction_id,
    } : undefined,
  };

  // Send to Meta
  const response = await fetch(
    `https://graph.facebook.com/v19.0/${config.pixel_id}/events?access_token=${config.access_token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [serverEvent] }),
    }
  );

  const result = await response.json();
  // result = { events_received: 1, fbtrace_id: "AbCdEf..." }
  // events_received: 1 = Meta accepted the event
  // If 0, check result.messages for error details

  return { success: result.events_received === 1, response: result };
}

// Event name mapping: your names → Meta's expected names
function mapEventName(name: string): string {
  const map: Record<string, string> = {
    'page_view': 'PageView',
    'purchase': 'Purchase',
    'add_to_cart': 'AddToCart',
    'begin_checkout': 'InitiateCheckout',
    'sign_up': 'CompleteRegistration',
    'search': 'Search',
    'view_content': 'ViewContent',
    'add_payment_info': 'AddPaymentInfo',
    'lead': 'Lead',
  };
  return map[name.toLowerCase()] || name;
}
```

Why this matters: The _fbp and _fbc cookies are critical for Meta’s Event Match Quality (EMQ). _fbp is Meta’s browser fingerprint. _fbc contains the click ID from when the user clicked a Facebook ad. Including both gives Meta the highest confidence that this server event matches the right user. EMQ above 6.0 is considered good; with full data it reaches 8-9.

## 3.2 Google GA4 Measurement Protocol

```text
apps/event-processor/src/destinations/google-ga4.ts
// GA4 Measurement Protocol endpoint:
// POST https://www.google-analytics.com/mp/collect
//   ?measurement_id=G-XXXXXXXXXX&api_secret=YYYYYYYY

export async function sendToGA4(event: HashedEvent, config: GA4Config) {
  const payload = {
    client_id: event.cookies?._ga?.replace('GA1.1.', '') || event.event_id,
    events: [{
      name: event.event_name,  // GA4 uses snake_case: "purchase", "page_view"
      params: {
        session_id: event.session_id,
        engagement_time_msec: '100',
        page_location: event.page_url,
        page_referrer: event.referrer,
        // E-commerce params (GA4 format)
        ...(event.ecommerce ? {
          transaction_id: event.ecommerce.transaction_id,
          value: event.ecommerce.value,
          currency: event.ecommerce.currency,
          items: event.ecommerce.items.map(item => ({
            item_name: item.item_name,
            quantity: item.quantity,
            price: item.price,
          })),
        } : {}),
      },
    }],
  };

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${config.measurement_id}&api_secret=${config.api_secret}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // GA4 MP returns 204 with empty body on success
  // Validation endpoint (for debugging):
  // https://www.google-analytics.com/debug/mp/collect
  return { success: response.status === 204 };
}
```

## 3.3 TikTok Events API

```text
apps/event-processor/src/destinations/tiktok.ts
// TikTok Events API endpoint:
// POST https://business-api.tiktok.com/open_api/v1.3/event/track/
// Auth via Access-Token header

export async function sendToTikTok(event: HashedEvent, config: TikTokConfig) {
  const payload = {
    event_source: 'web',
    event_source_id: config.pixel_code,
    data: [{
      event: mapTikTokEvent(event.event_name),
      event_id: event.event_id,
      event_time: Math.floor(event.timestamp / 1000),
      context: {
        page: { url: event.page_url, referrer: event.referrer },
        user: {
          email: event.user_data_hashed.em,
          phone: event.user_data_hashed.ph,
          ip: event.ip,
          user_agent: event.userAgent,
          ttclid: event.cookies?.ttclid,  // TikTok click ID
        },
        ad: { callback: event.cookies?.ttclid },
      },
      properties: event.ecommerce ? {
        value: event.ecommerce.value,
        currency: event.ecommerce.currency,
        order_id: event.ecommerce.transaction_id,
        contents: event.ecommerce.items.map(item => ({
          content_name: item.item_name,
          quantity: item.quantity,
          price: item.price,
        })),
      } : undefined,
    }],
  };

  const response = await fetch(
    'https://business-api.tiktok.com/open_api/v1.3/event/track/',
    {
      method: 'POST',
      headers: {
        'Access-Token': config.access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();
  return { success: result.code === 0, response: result };
}

function mapTikTokEvent(name: string): string {
  const map: Record<string, string> = {
    'purchase': 'CompletePayment',
    'add_to_cart': 'AddToCart',
    'begin_checkout': 'InitiateCheckout',
    'page_view': 'PageView',
    'view_content': 'ViewContent',
    'sign_up': 'CompleteRegistration',
  };
  return map[name.toLowerCase()] || name;
}
```

Interview answer: Each platform has a different API format, authentication method, and event naming convention. My event processor normalizes the incoming data into a canonical format, then each destination adapter translates it into the platform’s specific schema. Meta uses PascalCase event names and graph API auth. Google GA4 uses snake_case and API secrets. TikTok uses their own event names and bearer tokens. The adapter pattern keeps the core pipeline clean.

## 3.4 The Router — Fan-Out to All Destinations

```text
apps/event-processor/src/pipeline/route.ts
// This is step 6: send the enriched, hashed event to all configured destinations

import { sendToMeta } from '../destinations/meta';
import { sendToGA4 } from '../destinations/google-ga4';
import { sendToTikTok } from '../destinations/tiktok';

export async function routeToDestinations(event: HashedEvent, config: ContainerConfig) {
  const results: DeliveryResult[] = [];

  // Get all gateway configs for this account
  // These were set up by the customer in the dashboard
  const gateways = config.gateways.filter(g => g.enabled);

  // Send to ALL destinations IN PARALLEL
  // Why parallel? Each API call takes 100-500ms.
  // Sequential: 3 platforms x 300ms = 900ms
  // Parallel:   3 platforms x 300ms = 300ms (they run simultaneously)
  const promises = gateways.map(async (gateway) => {
    try {
      switch (gateway.provider) {
        case 'meta':
          return await sendToMeta(event, gateway);
        case 'google_ga4':
          return await sendToGA4(event, gateway);
        case 'tiktok':
          return await sendToTikTok(event, gateway);
        // Add more: snapchat, google_ads, pinterest...
      }
    } catch (error) {
      // Don't let one failed destination block others
      // If Meta API is down, Google and TikTok should still receive
      return { success: false, provider: gateway.provider, error: error.message };
    }
  });

  const deliveryResults = await Promise.all(promises);

  // Return which platforms succeeded and which failed
  // This gets logged to ClickHouse for the dashboard
  return deliveryResults;
}
```

## 3.5 Delivery Retries, Failure Handling, and Replay

A destination should not be marked failed after a single transient error. For timeouts, 5xx responses, temporary rate limits, and network failures, the platform should automatically retry the delivery 3-5 times using exponential backoff, for example 5 seconds, 30 seconds, 2 minutes, 10 minutes, and 30 minutes.

Each retry attempt should create its own delivery-attempt log record with event_id, provider, attempt_number, request timestamp, response code, latency, error message, and final outcome. After the final allowed retry, mark that provider delivery as failed and move it into a replayable failed-events queue.

Why this matters: ad platform APIs fail temporarily in real life. Automatic retries recover a large share of deliveries without manual intervention, while the detailed attempt history makes debugging and customer support much easier.

# Phase 4: The Dashboard (What Customers See)

The dashboard is how customers interact with your platform. It’s built with Next.js 14 (App Router) and communicates with the NestJS API.

## 4.1 Key Pages to Build

### Gateway Configuration Page

This is where customers connect their ad platforms. For each platform (Meta, Google, TikTok), they enter their API credentials:

- Meta: Pixel ID + Access Token (from Facebook Business Settings)
- Google GA4: Measurement ID (G-XXXXXXX) + API Secret (from GA4 Admin)
- TikTok: Pixel Code + Access Token (from TikTok Business Center)

Your frontend sends these to the NestJS API, which encrypts the tokens with AES-256-GCM and stores them in the gateway_configs table. The event processor reads them (decrypted) when routing events.

### Real-Time Logs / Log View System

Shows a live stream of every important lifecycle action in the platform, not just the final accepted event. The Log View System should display received, validated, deduplicated, enriched, hashed, queued, sent, retried, delivered, and failed states. Use Server-Sent Events (SSE) from the API for live updates and ClickHouse for historical search and filtering.

Each log entry should show: timestamp, event ID, event name, page URL, pipeline stage, provider, attempt number, response code, latency, next retry time, final destination status (queued, retrying, delivered, failed), and total processing time.

### Retry Monitoring and Failed Events

If a destination call fails, the system should automatically retry it 3-5 times before classifying that provider delivery as failed. The Log View System must show the retry timeline, the last error message, the next retry time, and the final failure state.

The same Log View System should also expose important platform activity such as gateway credential updates, domain verification changes, replay actions, login and security events, subscription changes, and worker failures so operators can understand everything happening in the project from one place.

### Analytics Page

Charts powered by ClickHouse queries: events per day (line chart), events by platform (bar chart), success/failure rates (pie chart), top event types, and geographic distribution.

## 4.2 Usage and Billing Page

Shows the customer their current event count vs. plan limit, with a progress bar and upgrade button. When they click upgrade, you create a Stripe Checkout session and redirect them to Stripe’s hosted payment page.

# Phase 5: Billing with Stripe

Usage-based billing is what makes this a real business. Here’s how it works end-to-end:

## 5.1 The Billing Cycle

Every time an event passes through the pipeline, step 7 increments a Redis counter:

```text
Usage counting in the event processor
// At the end of every processed event:
const month = new Date().toISOString().slice(0, 7); // "2026-04"
await redis.incr(`usage:${config.account_id}:${month}`);

// A background worker (cron job) runs every hour:
// 1. Reads all usage:*:2026-04 keys from Redis
// 2. Writes them to the usage_monthly table in PostgreSQL
// 3. This is what the dashboard reads for the usage chart
```

Stripe handles the actual payments. You create subscription plans in the Stripe dashboard, then your API creates checkout sessions and listens for webhook events (payment succeeded, subscription cancelled, etc.).

Interview answer: I implemented usage-based billing with a Redis counter that increments on every processed event. A background worker syncs these counts to PostgreSQL hourly for dashboard display. Stripe handles payment processing — I create checkout sessions for upgrades and listen for webhooks to update account plans. The event processor checks the quota on every request and returns 429 when exceeded.

# Phase 6: Custom Domains and SSL

Custom domains are what make server-side tracking invisible to ad blockers. Without this, events go to tracking.yourplatform.com, which blocklists will eventually catch. With it, events go to data.customershop.com, which looks like a first-party request.

## 6.1 How It Works

The customer adds a CNAME DNS record pointing their subdomain to your platform:

```text
DNS Configuration (customer does this)
Type:  CNAME
Name:  data                              // creates data.theirshop.com
Value: c-abc123.tracking.yourplatform.com // points to your server
```

Your platform then automatically provisions an SSL certificate for the custom domain using Let’s Encrypt (via cert-manager in Kubernetes or the ACME protocol directly). This takes about 30 seconds.

Once the DNS propagates and the SSL certificate is issued, all tracking requests go through the customer’s own domain with full HTTPS encryption. The browser sees it as a same-site request.

# Phase 7: Deployment and Launch

You already have a render.yaml for Render.com deployment. Here’s the full deployment strategy:

## 7.1 Development (Where You Are Now)

- Docker Compose for databases locally (PostgreSQL, Redis, ClickHouse)
- npm run dev runs all three services with hot reload
- Render.com free tier for initial cloud deployment and testing

## 7.2 Production Launch

- Render.com or Railway.app for the three application services (API, event processor, frontend)
- Neon (neon.tech) for managed PostgreSQL (free tier available, scales well)
- Upstash for managed Redis (serverless, pay-per-request)
- ClickHouse Cloud for managed ClickHouse (free tier: 10GB storage)
- Cloudflare for DNS management and DDoS protection
- Stripe for billing (no upfront cost, 2.9% + 30c per transaction)

## 7.3 Cost at Launch

With managed services on free/starter tiers, your monthly cost can be as low as $50-100/month. At $9-29/month per customer, you break even with 5-10 paying customers.

# Development Roadmap: Week-by-Week Plan

Based on your current progress (auth + container CRUD complete, all three services running), here’s a realistic week-by-week plan:

| Week | Focus | Deliverable |
| --- | --- | --- |
| 1-2 | Event Pipeline Core | POST /collect endpoint, validation, deduplication, enrichment, PII hashing, ClickHouse write. Test with curl/Postman. |
| 3 | Meta CAPI Integration | Meta destination adapter, gateway_configs table, test with Meta’s Event Testing tool in Events Manager. |
| 4 | Dashboard: Gateway Config | Frontend page to enter Meta Pixel ID + token. API to store encrypted credentials. Connection test button. |
| 5 | Dashboard: Logs + Analytics | Real-time Log View System (SSE), retry monitoring, failed-event explorer, and basic analytics charts (events/day, by platform, success rate). |
| 6 | Google GA4 + TikTok | Two more destination adapters. Dashboard gateway config for both. Full 3-platform routing. |
| 7 | Billing + Usage | Stripe integration, usage metering, plan limits, upgrade flow. Usage dashboard page. |
| 8 | Custom Domains + Polish | DNS verification, SSL provisioning, custom domain config in dashboard. Landing page, pricing page. |
| 9-10 | Testing + Launch | End-to-end testing with real websites, deploy to production, documentation, first beta users. |

# Interview Guide: How to Explain This Project

If someone asks you about this project in an interview, here are the key answers organized by common questions:

## What is this project?

Interview answer: I built a SaaS platform that helps e-commerce businesses and marketing agencies implement server-side tracking. Instead of relying on browser-side tracking pixels that get blocked by ad blockers and restricted by Safari/iOS, my platform receives events on a server the business controls, enriches them with geo-IP and device data, and forwards them to Meta, Google, and TikTok via their Conversions APIs. This recovers 30-40% of conversion data that would otherwise be lost.

## What’s the tech stack?

Interview answer: It’s a TypeScript monorepo with three services. The dashboard API uses NestJS with Prisma ORM for PostgreSQL. The event processor uses Fastify for high-throughput HTTP handling. The frontend is Next.js 14 with the App Router. For data, I use PostgreSQL for transactional data, Redis for real-time caching and deduplication, and ClickHouse for analytics-scale event storage. The whole thing runs in Docker locally and deploys to Render.com with managed database services.

## What was the hardest part?

Interview answer: Getting the event pipeline right. Each ad platform has a different API format, authentication method, and set of required fields. Meta requires SHA256-hashed PII and specific cookie values for user matching. Google GA4 uses a completely different measurement protocol. TikTok has its own event naming convention. I built an adapter pattern where the core pipeline normalizes the data, and each destination adapter translates it into the platform-specific format. The tricky part was handling failures gracefully — if Meta’s API is down, Google and TikTok should still receive the event.

## How do you handle scale?

Interview answer: The event processor is stateless — all shared state lives in Redis (deduplication, sessions, rate limits) or ClickHouse (event storage). This means I can horizontally scale by running multiple processor instances behind a load balancer. Redis handles dedup with SETNX which is atomic, so even concurrent processors won’t double-count. ClickHouse is columnar and partitioned by month, so it handles billions of rows with fast aggregation. At the current architecture, a single processor handles about 5,000 events per second.

## How do you handle security?

Interview answer: Multiple layers. JWT access tokens expire in 15 minutes. Gateway credentials (Meta tokens, Google API secrets) are encrypted with AES-256-GCM at rest in PostgreSQL. Row-level security ensures tenants can never access each other’s data. All PII is SHA256 hashed before it touches any external API or long-term storage. Rate limiting is enforced per-account via Redis sliding windows. The event processor validates every request against a Zod schema before processing.

End of Guide

Start with Phase 2 (Event Pipeline). That’s what makes this platform real.

Updated requirement: the dashboard must include a Log View System that shows the full event lifecycle and platform activity history. Failed destination calls must retry automatically 3-5 times before being marked failed, and each attempt must be visible in the logs.

Workflow with Claude code

Here's the workflow:

### 1. I fix the issues on this branch

I'm working on branch claude/review-git-repo-ZpvRv. I'll make the fixes, commit, and push to this branch on your GitHub repo.

### 2. You pull the changes locally

```text
git fetch origin claude/review-git-repo-ZpvRv
git checkout claude/review-git-repo-ZpvRv
```

### 3. Review & merge into main

Option A — Merge directly:

```text
git checkout main
git merge claude/review-git-repo-ZpvRv
git push origin main
```

Option B — Create a Pull Request (recommended for review): I can create a PR for you on GitHub so you can review the changes before merging.
