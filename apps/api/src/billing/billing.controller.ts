import { Body, Controller, Get, Post, Query, Req, UsePipes } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { upsertSubscriptionSchema, type UpsertSubscriptionInput } from "@sst/shared";

import { AuthService } from "../auth/auth.service";
import { ZodValidationPipe } from "../common/zod.pipe";
import { BillingService } from "./billing.service";

@Controller("billing")
export class BillingController {
  constructor(
    private readonly authService: AuthService,
    private readonly billingService: BillingService,
  ) {}

  @Get()
  async overview(@Req() request: FastifyRequest, @Query("accountId") accountId?: string) {
    const resolvedAccountId = await this.authService.resolveAccountId(request, accountId);
    return this.billingService.getOverview(resolvedAccountId);
  }

  @Post("subscriptions")
  @UsePipes(new ZodValidationPipe(upsertSubscriptionSchema))
  async upsert(
    @Req() request: FastifyRequest,
    @Body() body: UpsertSubscriptionInput,
    @Query("accountId") accountId?: string,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request, accountId);
    return this.billingService.upsertSubscription(resolvedAccountId, body);
  }
}
