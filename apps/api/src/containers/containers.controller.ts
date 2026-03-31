import { Body, Controller, Get, Post, UsePipes } from "@nestjs/common";

import { createContainerSchema, type CreateContainerInput } from "@sst/shared";

import { ZodValidationPipe } from "../common/zod.pipe";

const sampleContainers = [
  {
    id: "seed-container-1",
    name: "Primary Storefront",
    gtmId: "GTM-AAAA111",
    region: "global",
    status: "active",
    customDomain: "data.example.com",
  },
];

@Controller("containers")
export class ContainersController {
  @Get()
  list() {
    return {
      items: sampleContainers,
      total: sampleContainers.length,
    };
  }

  @Post()
  @UsePipes(new ZodValidationPipe(createContainerSchema))
  create(@Body() body: CreateContainerInput) {
    return {
      id: `container-${Date.now()}`,
      ...body,
      status: "active",
      createdAt: new Date().toISOString(),
    };
  }
}
