import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { AuthService } from "../auth/auth.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { ZodValidationPipe } from "../common/zod.pipe";
import { AnalyticsService } from "./analytics.service";

const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(30),
  containerId: z.string().uuid().optional(),
});

@Controller("analytics")
@UseGuards(SessionAuthGuard)
export class AnalyticsController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AnalyticsService) private readonly analyticsService: AnalyticsService,
  ) {}

  @Get("summary")
  async summary(
    @Req() request: FastifyRequest,
    @Query(new ZodValidationPipe(analyticsQuerySchema))
    query: { days: number; containerId?: string },
  ) {
    const accountId = await this.authService.requireAccountId(request);
    return this.analyticsService.getOverview(query.days, accountId, query.containerId);
  }

  @Get("timeseries")
  async timeseries(
    @Req() request: FastifyRequest,
    @Query(new ZodValidationPipe(analyticsQuerySchema))
    query: { days: number; containerId?: string },
  ) {
    const accountId = await this.authService.requireAccountId(request);
    return this.analyticsService.getTimeseries(query.days, accountId, query.containerId);
  }
}
