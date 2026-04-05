import { Controller, Get, Inject } from "@nestjs/common";

import { ClickHouseService } from "./common/clickhouse.service";
import { PrismaService } from "./common/prisma.service";
import { RedisService } from "./common/redis.service";

@Controller()
export class AppController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ClickHouseService) private readonly clickhouse: ClickHouseService,
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
    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.client.ping(),
      this.clickhouse.ping(),
    ]);

    const [postgresResult, redisResult, clickhouseResult] = checks;
    const dependencies = {
      postgres: this.resolveDependencyStatus(postgresResult, () => "ok"),
      redis: this.resolveDependencyStatus(redisResult, (value) =>
        value === "PONG" ? "ok" : String(value),
      ),
      clickhouse: this.resolveDependencyStatus(clickhouseResult, (value) =>
        value ? "ok" : "error",
      ),
    };

    const hasFailure = Object.values(dependencies).some(
      (dependency) => dependency.status !== "ok",
    );

    return {
      status: hasFailure ? "degraded" : "ok",
      service: "sst-dashboard-api",
      checkedAt: new Date().toISOString(),
      dependencies,
    };
  }

  private resolveDependencyStatus<T>(
    result: PromiseSettledResult<T>,
    onSuccess: (value: T) => string,
  ): { status: string; error?: string } {
    if (result.status === "fulfilled") {
      return {
        status: onSuccess(result.value),
      };
    }

    return {
      status: "error",
      error: this.formatHealthError(result.reason),
    };
  }

  private formatHealthError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return "Unknown dependency failure";
  }
}
