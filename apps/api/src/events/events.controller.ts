import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards, UsePipes } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { eventLogRecordSchema, type EventLogRecordInput } from "@sst/shared";

import { AuthService } from "../auth/auth.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { ZodValidationPipe } from "../common/zod.pipe";
import { EventsService } from "./events.service";

@Controller("events")
export class EventsController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(EventsService) private readonly eventsService: EventsService,
  ) {}

  @Get()
  @UseGuards(SessionAuthGuard)
  list(
    @Req() request: FastifyRequest,
    @Query("limit") limit?: string,
    @Query("containerId") containerId?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 50;
    return this.authService
      .requireAccountId(request)
      .then((accountId) =>
        this.eventsService.list(Number.isNaN(parsedLimit) ? 50 : parsedLimit, accountId, containerId),
      );
  }

  @Post("internal")
  @UsePipes(new ZodValidationPipe(eventLogRecordSchema))
  create(@Body() body: EventLogRecordInput) {
    return this.eventsService.ingestFromProcessor(body);
  }
}
