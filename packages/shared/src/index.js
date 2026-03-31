"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackingEventSchema = exports.createContainerSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    accountName: zod_1.z.string().min(2).max(120),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
exports.createContainerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    gtmId: zod_1.z.string().min(4).max(32).optional(),
    serverUrl: zod_1.z.string().url().optional(),
    customDomain: zod_1.z.string().min(3).optional(),
    region: zod_1.z.enum(["global", "eu", "us", "apac"]).default("global"),
});
exports.trackingEventSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid().optional(),
    accountId: zod_1.z.string().uuid().optional(),
    containerId: zod_1.z.string().uuid().optional(),
    eventName: zod_1.z.string().min(1),
    timestamp: zod_1.z.union([zod_1.z.string().datetime(), zod_1.z.number().int().positive()]).optional(),
    clientId: zod_1.z.string().min(1),
    sessionId: zod_1.z.string().optional(),
    ip: zod_1.z.string().optional(),
    userAgent: zod_1.z.string().optional(),
    pageUrl: zod_1.z.string().url().optional(),
    referrer: zod_1.z.string().optional(),
    revenue: zod_1.z.number().nonnegative().optional(),
    currency: zod_1.z.string().length(3).default("USD"),
    properties: zod_1.z.record(zod_1.z.any()).default({}),
    destinations: zod_1.z.array(zod_1.z.enum(["meta", "google", "tiktok", "snap", "ga4"])).default([]),
});
