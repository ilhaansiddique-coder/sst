import { z } from "zod";

export const destinationSchema = z.enum(["meta", "google", "tiktok", "snap", "ga4"]);
export const gatewayProviderSchema = z.enum(["meta", "tiktok", "snap", "ga4", "google_ads"]);
export const planSchema = z.enum(["hobby", "starter", "growth", "scale", "enterprise"]);
export const subscriptionStatusSchema = z.enum(["active", "past_due", "canceled", "trialing"]);
export const eventLogStatusSchema = z.enum(["received", "processed", "failed", "delivered"]);

export const registerSchema = z.object({
  accountName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const createContainerSchema = z.object({
  name: z.string().min(2).max(120),
  gtmId: z.string().min(4).max(32).optional(),
  serverUrl: z.string().url().optional(),
  customDomain: z.string().min(3).optional(),
  region: z.enum(["global", "eu", "us", "apac"]).default("global"),
});

export const trackingEventSchema = z.object({
  eventId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  containerId: z.string().uuid().optional(),
  eventName: z.string().min(1),
  timestamp: z.union([z.string().datetime(), z.number().int().positive()]).optional(),
  clientId: z.string().min(1),
  sessionId: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  pageUrl: z.string().url().optional(),
  referrer: z.string().optional(),
  revenue: z.number().nonnegative().optional(),
  currency: z.string().length(3).default("USD"),
  properties: z.record(z.any()).default({}),
  destinations: z.array(destinationSchema).default([]),
});

export const eventLogRecordSchema = trackingEventSchema.extend({
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  status: eventLogStatusSchema.default("received"),
  source: z.literal("processor").default("processor"),
  receivedAt: z.string().datetime(),
});

export const createGatewayConfigSchema = z.object({
  containerId: z.string().uuid().optional(),
  provider: gatewayProviderSchema,
  credentials: z.record(z.any()).default({}),
  settings: z.record(z.any()).default({}),
  enabled: z.boolean().default(true),
});

export const updateGatewayConfigSchema = createGatewayConfigSchema.partial();

export const upsertSubscriptionSchema = z.object({
  plan: planSchema,
  status: subscriptionStatusSchema,
  stripeSubId: z.string().min(1).optional(),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
});

export const kvEntryWriteSchema = z.object({
  value: z.any(),
  tags: z.array(z.string()).default([]),
  ttlSeconds: z.coerce.number().int().positive().max(60 * 60 * 24 * 365).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateContainerInput = z.infer<typeof createContainerSchema>;
export type TrackingEventInput = z.infer<typeof trackingEventSchema>;
export type EventLogRecordInput = z.infer<typeof eventLogRecordSchema>;
export type CreateGatewayConfigInput = z.infer<typeof createGatewayConfigSchema>;
export type UpdateGatewayConfigInput = z.infer<typeof updateGatewayConfigSchema>;
export type UpsertSubscriptionInput = z.infer<typeof upsertSubscriptionSchema>;
export type KvEntryWriteInput = z.infer<typeof kvEntryWriteSchema>;
