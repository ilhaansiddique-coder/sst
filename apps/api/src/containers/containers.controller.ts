import { Body, Controller, Get, Post, Query, Req, UsePipes } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { createContainerSchema, type CreateContainerInput } from "@sst/shared";

import { AuthService } from "../auth/auth.service";
import { ZodValidationPipe } from "../common/zod.pipe";
import { ContainersService } from "./containers.service";

@Controller("containers")
export class ContainersController {
  constructor(
    private readonly authService: AuthService,
    private readonly containersService: ContainersService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest, @Query("accountId") accountId?: string) {
    const resolvedAccountId = await this.authService.resolveAccountId(request, accountId);
    const items = await this.containersService.list(resolvedAccountId);

    return {
      items,
      total: items.length,
    };
  }

  @Post()
  @UsePipes(new ZodValidationPipe(createContainerSchema))
  async create(
    @Body() body: CreateContainerInput,
    @Req() request: FastifyRequest,
    @Query("accountId") accountId?: string,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request, accountId);
    return this.containersService.create(resolvedAccountId, body);
  }
}
