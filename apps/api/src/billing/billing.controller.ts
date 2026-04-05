import { Body, Controller, Get, Inject, Post, Req, UseGuards, UsePipes } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { upsertSubscriptionSchema, type UpsertSubscriptionInput } from "@sst/shared";

import { AuthService } from "../auth/auth.service";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { ZodValidationPipe } from "../common/zod.pipe";
import { BillingService } from "./billing.service";

@Controller("billing")
@UseGuards(SessionAuthGuard)
export class BillingController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(BillingService) private readonly billingService: BillingService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles("owner", "admin")
  async overview(@Req() request: FastifyRequest) {
    const resolvedAccountId = await this.authService.requireAccountId(request);
    return this.billingService.getOverview(resolvedAccountId);
  }

  @Post("subscriptions")
  @UsePipes(new ZodValidationPipe(upsertSubscriptionSchema))
  @UseGuards(RolesGuard)
  @Roles("owner")
  async upsert(
    @Req() request: FastifyRequest,
    @Body() body: UpsertSubscriptionInput,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request);
    return this.billingService.upsertSubscription(resolvedAccountId, body);
  }
}
