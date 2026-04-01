import { Body, Controller, Get, Post, Query, UsePipes } from "@nestjs/common";

import { eventLogRecordSchema, type EventLogRecordInput } from "@sst/shared";

import { ZodValidationPipe } from "../common/zod.pipe";
import { EventsService } from "./events.service";

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  list(
    @Query("limit") limit?: string,
    @Query("accountId") accountId?: string,
    @Query("containerId") containerId?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 50;
    return this.eventsService.list(Number.isNaN(parsedLimit) ? 50 : parsedLimit, accountId, containerId);
  }

  @Post("internal")
  @UsePipes(new ZodValidationPipe(eventLogRecordSchema))
  create(@Body() body: EventLogRecordInput) {
    return this.eventsService.ingestFromProcessor(body);
  }
}
