import { Injectable, NotFoundException } from "@nestjs/common";

import type { CreateGatewayConfigInput, UpdateGatewayConfigInput } from "@sst/shared";

import { PrismaService } from "../common/prisma.service";

@Injectable()
export class GatewaysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(accountId?: string) {
    return this.prisma.gatewayConfig.findMany({
      where: accountId ? { accountId } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async create(accountId: string, input: CreateGatewayConfigInput) {
    if (input.containerId) {
      const container = await this.prisma.container.findFirst({
        where: { id: input.containerId, accountId },
      });

      if (!container) {
        throw new NotFoundException("Container not found for this account.");
      }
    }

    return this.prisma.gatewayConfig.create({
      data: {
        accountId,
        containerId: input.containerId,
        provider: input.provider,
        credentials: input.credentials,
        settings: input.settings,
        enabled: input.enabled,
      },
    });
  }

  async update(id: string, accountId: string, input: UpdateGatewayConfigInput) {
    const existing = await this.prisma.gatewayConfig.findFirst({
      where: { id, accountId },
    });

    if (!existing) {
      throw new NotFoundException("Gateway config not found.");
    }

    if (input.containerId) {
      const container = await this.prisma.container.findFirst({
        where: { id: input.containerId, accountId },
      });

      if (!container) {
        throw new NotFoundException("Container not found for this account.");
      }
    }

    return this.prisma.gatewayConfig.update({
      where: { id },
      data: {
        containerId: input.containerId,
        provider: input.provider,
        credentials: input.credentials,
        settings: input.settings,
        enabled: input.enabled,
      },
    });
  }
}
