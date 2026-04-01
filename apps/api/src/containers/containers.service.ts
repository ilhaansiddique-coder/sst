import { Injectable, NotFoundException } from "@nestjs/common";

import type { CreateContainerInput } from "@sst/shared";

import { PrismaService } from "../common/prisma.service";

@Injectable()
export class ContainersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(accountId?: string) {
    return this.prisma.container.findMany({
      where: accountId ? { accountId } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async create(accountId: string, input: CreateContainerInput) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });

    if (!account) {
      throw new NotFoundException("Account not found.");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_account_id', ${accountId}, true)`;

      return tx.container.create({
        data: {
          accountId,
          name: input.name,
          gtmId: input.gtmId,
          serverUrl: input.serverUrl,
          customDomain: input.customDomain,
          region: input.region,
        },
      });
    });
  }
}
