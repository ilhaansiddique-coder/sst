import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "./app.module";
import { getApiEnv } from "./common/env";
import { loadEnv } from "./common/load-env";

async function bootstrap(): Promise<void> {
  loadEnv();
  const env = getApiEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix("api");

  await app.listen({
    port: env.PORT,
    host: "0.0.0.0",
  });

  Logger.log(`API listening on http://localhost:${env.PORT}/api`, "Bootstrap");
}

bootstrap().catch((error) => {
  Logger.error(error, "Bootstrap");
  process.exit(1);
});
