import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";

import { ZodValidationPipe } from "../common/zod.pipe";
import { AnalyticsService } from "./analytics.service";

const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(30),
  accountId: z.string().uuid().optional(),
  containerId: z.string().uuid().optional(),
});

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("summary")
  async summary(
    @Query(new ZodValidationPipe(analyticsQuerySchema))
    query: { days: number; accountId?: string; containerId?: string },
  ) {
    return this.analyticsService.getOverview(query.days, query.accountId, query.containerId);
  }

  @Get("timeseries")
  async timeseries(
    @Query(new ZodValidationPipe(analyticsQuerySchema))
    query: { days: number; accountId?: string; containerId?: string },
  ) {
    return this.analyticsService.getTimeseries(query.days, query.accountId, query.containerId);
  }
}
