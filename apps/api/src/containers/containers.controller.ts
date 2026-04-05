import { Body, Controller, Get, Inject, Post, Req, UseGuards, UsePipes } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { createContainerSchema, type CreateContainerInput } from "@sst/shared";

import { AuthService } from "../auth/auth.service";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { ZodValidationPipe } from "../common/zod.pipe";
import { ContainersService } from "./containers.service";

@Controller("containers")
@UseGuards(SessionAuthGuard)
export class ContainersController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ContainersService) private readonly containersService: ContainersService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    const resolvedAccountId = await this.authService.requireAccountId(request);
    const items = await this.containersService.list(resolvedAccountId);

    return {
      items,
      total: items.length,
    };
  }

  @Post()
  @UsePipes(new ZodValidationPipe(createContainerSchema))
  @UseGuards(RolesGuard)
  @Roles("owner", "admin")
  async create(
    @Body() body: CreateContainerInput,
    @Req() request: FastifyRequest,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request);
    return this.containersService.create(resolvedAccountId, body);
  }
}
