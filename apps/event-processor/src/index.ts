import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { randomUUID } from "node:crypto";

import { trackingEventSchema } from "@sst/shared";

import { loadEnv } from "./load-env";

loadEnv();

const app = Fastify({ logger: true });
const seenEvents = new Map<string, number>();

const port = Number(process.env.PORT ?? 3002);

app.register(fastifyCors, {
  origin: true,
});

app.get("/health", async () => ({
  status: "ok",
  service: "sst-event-processor",
  checkedAt: new Date().toISOString(),
}));

app.post("/events/ingest", async (request, reply) => {
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

  if (seenEvents.has(dedupeKey)) {
    return reply.status(202).send({
      accepted: false,
      reason: "duplicate",
      eventId,
    });
  }

  seenEvents.set(dedupeKey, Date.now());

  return reply.status(202).send({
    accepted: true,
    eventId,
    routedDestinations: event.destinations,
    nextStep: "Connect Redis, ClickHouse, and gateway workers for production-grade processing.",
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
