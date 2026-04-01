import { Controller, Get } from "@nestjs/common";

import { ClickHouseService } from "./common/clickhouse.service";
import { PrismaService } from "./common/prisma.service";
import { RedisService } from "./common/redis.service";

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly clickhouse: ClickHouseService,
  ) {}

  @Get()
  getRoot() {
    return {
      service: "sst-dashboard-api",
      version: "0.1.0",
      message: "SST dashboard API is backed by PostgreSQL, Redis, and ClickHouse.",
    };
  }

  @Get("health")
  async getHealth() {
    const [postgres, redis, clickhouse] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.client.ping(),
      this.clickhouse.ping(),
    ]);

    return {
      status: "ok",
      service: "sst-dashboard-api",
      checkedAt: new Date().toISOString(),
      dependencies: {
        postgres: Array.isArray(postgres) ? "ok" : "ok",
        redis,
        clickhouse: clickhouse ? "ok" : "error",
      },
    };
  }
}
