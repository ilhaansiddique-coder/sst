import { Injectable } from "@nestjs/common";

import type { EventLogRecordInput } from "@sst/shared";

import { ClickHouseService } from "../common/clickhouse.service";
import { PrismaService } from "../common/prisma.service";

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clickhouse: ClickHouseService,
  ) {}

  async list(limit: number, accountId?: string, containerId?: string) {
    const items = await this.clickhouse.listRecentEvents({
      limit,
      accountId,
      containerId,
    });

    return {
      items,
      total: items.length,
    };
  }

  async ingestFromProcessor(record: EventLogRecordInput) {
    if (!record.accountId) {
      return {
        accepted: true,
        eventId: record.eventId,
        usageUpdated: false,
      };
    }

    const eventTime = new Date(record.timestamp);
    const usageMonth = new Date(Date.UTC(eventTime.getUTCFullYear(), eventTime.getUTCMonth(), 1));
    const metaIncrement = BigInt(record.destinations.includes("meta") ? 1 : 0);
    const tiktokIncrement = BigInt(record.destinations.includes("tiktok") ? 1 : 0);
    const googleIncrement = BigInt(
      record.destinations.includes("google") || record.destinations.includes("ga4") ? 1 : 0,
    );

    await this.prisma.usageMonthly.upsert({
      where: {
        accountId_month: {
          accountId: record.accountId,
          month: usageMonth,
        },
      },
      create: {
        accountId: record.accountId,
        month: usageMonth,
        eventsTotal: BigInt(1),
        eventsMeta: metaIncrement,
        eventsTiktok: tiktokIncrement,
        eventsGoogle: googleIncrement,
      },
      update: {
        eventsTotal: { increment: BigInt(1) },
        eventsMeta: { increment: metaIncrement },
        eventsTiktok: { increment: tiktokIncrement },
        eventsGoogle: { increment: googleIncrement },
      },
    });

    return {
      accepted: true,
      eventId: record.eventId,
      usageUpdated: true,
    };
  }
}
