import { Body, Controller, Get, Patch, Post, Query, Req, UsePipes } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import {
  createGatewayConfigSchema,
  updateGatewayConfigSchema,
  type CreateGatewayConfigInput,
  type UpdateGatewayConfigInput,
} from "@sst/shared";

import { AuthService } from "../auth/auth.service";
import { ZodValidationPipe } from "../common/zod.pipe";
import { GatewaysService } from "./gateways.service";

const updateGatewayBodySchema = z
  .object({ id: z.string().uuid() })
  .merge(updateGatewayConfigSchema);

@Controller("gateways")
export class GatewaysController {
  constructor(
    private readonly authService: AuthService,
    private readonly gatewaysService: GatewaysService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query("accountId") accountId?: string) {
    const resolvedAccountId = await this.authService.resolveAccountId(request, accountId);
    const items = await this.gatewaysService.list(resolvedAccountId);

    return {
      items,
      total: items.length,
    };
  }

  @Post()
  @UsePipes(new ZodValidationPipe(createGatewayConfigSchema))
  async create(
    @Req() request: FastifyRequest,
    @Body() body: CreateGatewayConfigInput,
    @Query("accountId") accountId?: string,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request, accountId);
    return this.gatewaysService.create(resolvedAccountId, body);
  }

  @Patch()
  @UsePipes(new ZodValidationPipe(updateGatewayBodySchema))
  async update(
    @Req() request: FastifyRequest,
    @Body() body: UpdateGatewayConfigInput & { id: string },
    @Query("accountId") accountId?: string,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request, accountId);
    const { id, ...input } = body;
    return this.gatewaysService.update(id, resolvedAccountId, input);
  }
}
