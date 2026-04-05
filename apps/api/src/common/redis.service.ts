import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";

import { getApiEnv } from "./env";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  readonly client = new Redis(getApiEnv().REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      await this.client.ping();
    } catch (error) {
      this.logger.error("Failed to connect to Redis during API startup.", error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status === "end") {
      return;
    }

    await this.client.quit();
  }
}
