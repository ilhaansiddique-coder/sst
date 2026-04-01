import { Injectable, NotFoundException } from "@nestjs/common";

import type { UpsertSubscriptionInput } from "@sst/shared";

import { PrismaService } from "../common/prisma.service";
import { RedisService } from "../common/redis.service";

function currentUsageMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getOverview(accountId?: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: accountId ? { accountId } : undefined,
      orderBy: { currentPeriodEnd: "desc" },
      include: { account: true },
    });

    const usageRows = await this.prisma.usageMonthly.findMany({
      where: accountId ? { accountId } : undefined,
      orderBy: { month: "desc" },
      take: 6,
    });

    const realtimeUsage = accountId
      ? await this.redis.client.hgetall(`sst:usage:${accountId}:${currentUsageMonth()}`)
      : {};

    return {
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.id,
        accountId: subscription.accountId,
        accountName: subscription.account.name,
        plan: subscription.plan,
        status: subscription.status,
        stripeSubId: subscription.stripeSubId,
        currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      })),
      usageMonthly: usageRows.map((usage) => ({
        accountId: usage.accountId,
        month: usage.month.toISOString().slice(0, 10),
        eventsTotal: usage.eventsTotal.toString(),
        eventsMeta: usage.eventsMeta.toString(),
        eventsTiktok: usage.eventsTiktok.toString(),
        eventsGoogle: usage.eventsGoogle.toString(),
      })),
      realtimeUsage,
    };
  }

  async upsertSubscription(accountId: string, input: UpsertSubscriptionInput) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });

    if (!account) {
      throw new NotFoundException("Account not found.");
    }

    const existing = input.stripeSubId
      ? await this.prisma.subscription.findUnique({
          where: { stripeSubId: input.stripeSubId },
        })
      : await this.prisma.subscription.findFirst({
          where: { accountId },
          orderBy: { currentPeriodEnd: "desc" },
        });

    const data = {
      accountId,
      stripeSubId: input.stripeSubId,
      plan: input.plan,
      status: input.status,
      currentPeriodStart: input.currentPeriodStart ? new Date(input.currentPeriodStart) : null,
      currentPeriodEnd: input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : null,
    };

    return existing
      ? this.prisma.subscription.update({
          where: { id: existing.id },
          data,
        })
      : this.prisma.subscription.create({ data });
  }
}
