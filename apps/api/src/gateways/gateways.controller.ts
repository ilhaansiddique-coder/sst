import { Body, Controller, Get, Inject, Patch, Post, Req, UseGuards, UsePipes } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import {
  createGatewayConfigSchema,
  updateGatewayConfigSchema,
  type CreateGatewayConfigInput,
  type UpdateGatewayConfigInput,
} from "@sst/shared";

import { AuthService } from "../auth/auth.service";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { ZodValidationPipe } from "../common/zod.pipe";
import { GatewaysService } from "./gateways.service";

const updateGatewayBodySchema = z
  .object({ id: z.string().uuid() })
  .merge(updateGatewayConfigSchema);
const testGatewayBodySchema = z.object({ id: z.string().uuid() });

@Controller("gateways")
@UseGuards(SessionAuthGuard)
export class GatewaysController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(GatewaysService) private readonly gatewaysService: GatewaysService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    const resolvedAccountId = await this.authService.requireAccountId(request);
    const items = await this.gatewaysService.list(resolvedAccountId);

    return {
      items,
      total: items.length,
    };
  }

  @Post()
  @UsePipes(new ZodValidationPipe(createGatewayConfigSchema))
  @UseGuards(RolesGuard)
  @Roles("owner", "admin")
  async create(
    @Req() request: FastifyRequest,
    @Body() body: CreateGatewayConfigInput,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request);
    return this.gatewaysService.create(resolvedAccountId, body);
  }

  @Post("test")
  @UsePipes(new ZodValidationPipe(testGatewayBodySchema))
  @UseGuards(RolesGuard)
  @Roles("owner", "admin")
  async testConnection(
    @Req() request: FastifyRequest,
    @Body() body: { id: string },
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request);
    return this.gatewaysService.testConnection(body.id, resolvedAccountId);
  }

  @Patch()
  @UsePipes(new ZodValidationPipe(updateGatewayBodySchema))
  @UseGuards(RolesGuard)
  @Roles("owner", "admin")
  async update(
    @Req() request: FastifyRequest,
    @Body() body: UpdateGatewayConfigInput & { id: string },
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request);
    const { id, ...input } = body;
    return this.gatewaysService.update(id, resolvedAccountId, input);
  }
}
