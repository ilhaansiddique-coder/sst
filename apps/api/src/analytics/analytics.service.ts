import { Injectable } from "@nestjs/common";

import { ClickHouseService } from "../common/clickhouse.service";
import { RedisService } from "../common/redis.service";

function currentUsageMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly clickhouse: ClickHouseService,
    private readonly redis: RedisService,
  ) {}

  async getOverview(days: number, accountId?: string, containerId?: string) {
    const summary = await this.clickhouse.getAnalyticsSummary({
      days,
      accountId,
      containerId,
    });

    const realtimeUsage = accountId
      ? await this.redis.client.hgetall(`sst:usage:${accountId}:${currentUsageMonth()}`)
      : {};

    return {
      days,
      totalEvents: Number(summary.totalEvents ?? 0),
      uniqueClients: Number(summary.uniqueClients ?? 0),
      totalRevenue: Number(summary.totalRevenue ?? 0),
      deliveredEvents: Number(summary.deliveredEvents ?? 0),
      failedEvents: Number(summary.failedEvents ?? 0),
      realtimeUsage,
    };
  }

  async getTimeseries(days: number, accountId?: string, containerId?: string) {
    const rows = await this.clickhouse.getEventTimeseries({
      days,
      accountId,
      containerId,
    });

    return rows.map((row) => ({
      bucket: row.bucket,
      totalEvents: Number(row.totalEvents ?? 0),
      revenue: Number(row.revenue ?? 0),
      uniqueClients: Number(row.uniqueClients ?? 0),
    }));
  }
}
