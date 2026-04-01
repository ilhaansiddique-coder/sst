import { Body, Controller, Delete, Get, Param, Put, Query, Req, UsePipes } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { kvEntryWriteSchema, type KvEntryWriteInput } from "@sst/shared";

import { AuthService } from "../auth/auth.service";
import { ZodValidationPipe } from "../common/zod.pipe";
import { StoreService } from "./store.service";

const listStoreQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
});

@Controller("store")
export class StoreController {
  constructor(
    private readonly authService: AuthService,
    private readonly storeService: StoreService,
  ) {}

  @Get(":collection")
  async list(
    @Req() request: FastifyRequest,
    @Param("collection") collection: string,
    @Query(new ZodValidationPipe(listStoreQuerySchema)) query: { limit: number },
    @Query("accountId") accountId?: string,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request, accountId);
    return this.storeService.list(resolvedAccountId, collection, query.limit);
  }

  @Get(":collection/:key")
  async get(
    @Req() request: FastifyRequest,
    @Param("collection") collection: string,
    @Param("key") key: string,
    @Query("accountId") accountId?: string,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request, accountId);
    return this.storeService.get(resolvedAccountId, collection, key);
  }

  @Put(":collection/:key")
  @UsePipes(new ZodValidationPipe(kvEntryWriteSchema))
  async set(
    @Req() request: FastifyRequest,
    @Param("collection") collection: string,
    @Param("key") key: string,
    @Body() body: KvEntryWriteInput,
    @Query("accountId") accountId?: string,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request, accountId);
    return this.storeService.set(resolvedAccountId, collection, key, body);
  }

  @Delete(":collection/:key")
  async delete(
    @Req() request: FastifyRequest,
    @Param("collection") collection: string,
    @Param("key") key: string,
    @Query("accountId") accountId?: string,
  ) {
    const resolvedAccountId = await this.authService.requireAccountId(request, accountId);
    return this.storeService.delete(resolvedAccountId, collection, key);
  }
}
