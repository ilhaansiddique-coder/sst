import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";

import { getApiEnv } from "./env";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client = new Redis(getApiEnv().REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
  });

  async onModuleInit(): Promise<void> {
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
