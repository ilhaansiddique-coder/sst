import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { kvEntryWriteSchema, type KvEntryWriteInput } from "@sst/shared";

import { AuthService } from "../auth/auth.service";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { ZodValidationPipe } from "../common/zod.pipe";
import { StoreService } from "./store.service";

const listStoreQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
});

@Controller("store")
@UseGuards(SessionAuthGuard)
export class StoreController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(StoreService) private readonly storeService: StoreService,
  ) {}

  @Get(":collection")
  async list(
    @Req() request: FastifyRequest,
    @Param("collection") collection: string,
    @Query(new ZodValidationPipe(listStoreQuerySchema)) query: { limit: number },
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request);
    return this.storeService.list(resolvedAccountId, collection, query.limit);
  }

  @Get(":collection/:key")
  async get(
    @Req() request: FastifyRequest,
    @Param("collection") collection: string,
    @Param("key") key: string,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request);
    return this.storeService.get(resolvedAccountId, collection, key);
  }

  @Put(":collection/:key")
  @UsePipes(new ZodValidationPipe(kvEntryWriteSchema))
  @UseGuards(RolesGuard)
  @Roles("owner", "admin")
  async set(
    @Req() request: FastifyRequest,
    @Param("collection") collection: string,
    @Param("key") key: string,
    @Body() body: KvEntryWriteInput,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request);
    return this.storeService.set(resolvedAccountId, collection, key, body);
  }

  @Delete(":collection/:key")
  @UseGuards(RolesGuard)
  @Roles("owner", "admin")
  async delete(
    @Req() request: FastifyRequest,
    @Param("collection") collection: string,
    @Param("key") key: string,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request);
    return this.storeService.delete(resolvedAccountId, collection, key);
  }
}
