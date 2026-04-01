import { Injectable, NotFoundException } from "@nestjs/common";

import type { KvEntryWriteInput } from "@sst/shared";

import { PrismaService } from "../common/prisma.service";
import { RedisService } from "../common/redis.service";

@Injectable()
export class StoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list(accountId: string, collection: string, limit: number) {
    const items = await this.prisma.kvStore.findMany({
      where: {
        accountId,
        collection,
        OR: [{ ttl: null }, { ttl: { gt: new Date() } }],
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return items.map((item) => this.serializeEntry(item));
  }

  async get(accountId: string, collection: string, key: string) {
    const cacheKey = this.getCacheKey(accountId, collection, key);
    const cached = await this.redis.client.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const item = await this.prisma.kvStore.findUnique({
      where: {
        accountId_collection_key: {
          accountId,
          collection,
          key,
        },
      },
    });

    if (!item) {
      throw new NotFoundException("Key not found.");
    }

    if (item.ttl && item.ttl.getTime() <= Date.now()) {
      await this.delete(accountId, collection, key);
      throw new NotFoundException("Key has expired.");
    }

    const serialized = this.serializeEntry(item);
    await this.cacheEntry(cacheKey, serialized, item.ttl);
    return serialized;
  }

  async set(accountId: string, collection: string, key: string, input: KvEntryWriteInput) {
    const ttl = input.ttlSeconds ? new Date(Date.now() + input.ttlSeconds * 1000) : null;

    const item = await this.prisma.kvStore.upsert({
      where: {
        accountId_collection_key: {
          accountId,
          collection,
          key,
        },
      },
      create: {
        accountId,
        collection,
        key,
        value: input.value,
        tags: input.tags,
        ttl,
      },
      update: {
        value: input.value,
        tags: input.tags,
        ttl,
        updatedAt: new Date(),
      },
    });

    const serialized = this.serializeEntry(item);
    await this.cacheEntry(this.getCacheKey(accountId, collection, key), serialized, ttl);
    return serialized;
  }

  async delete(accountId: string, collection: string, key: string) {
    await this.redis.client.del(this.getCacheKey(accountId, collection, key));

    const item = await this.prisma.kvStore.findUnique({
      where: {
        accountId_collection_key: {
          accountId,
          collection,
          key,
        },
      },
    });

    if (!item) {
      return { deleted: false };
    }

    await this.prisma.kvStore.delete({
      where: {
        accountId_collection_key: {
          accountId,
          collection,
          key,
        },
      },
    });

    return { deleted: true };
  }

  private async cacheEntry(cacheKey: string, value: unknown, ttl: Date | null) {
    const serialized = JSON.stringify(value);

    if (ttl) {
      const ttlSeconds = Math.max(1, Math.floor((ttl.getTime() - Date.now()) / 1000));
      await this.redis.client.set(cacheKey, serialized, "EX", ttlSeconds);
      return;
    }

    await this.redis.client.set(cacheKey, serialized);
  }

  private getCacheKey(accountId: string, collection: string, key: string): string {
    return `sst:kv:${accountId}:${collection}:${key}`;
  }

  private serializeEntry(item: {
    accountId: string;
    collection: string;
    key: string;
    value: unknown;
    tags: string[];
    ttl: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      accountId: item.accountId,
      collection: item.collection,
      key: item.key,
      value: item.value,
      tags: item.tags,
      ttl: item.ttl?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
