import { z } from "zod";

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
  destinations: z.array(z.enum(["meta", "google", "tiktok", "snap", "ga4"])).default([]),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateContainerInput = z.infer<typeof createContainerSchema>;
export type TrackingEventInput = z.infer<typeof trackingEventSchema>;
