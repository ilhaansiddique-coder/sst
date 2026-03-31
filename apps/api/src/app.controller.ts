import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      service: "sst-dashboard-api",
      version: "0.1.0",
      message: "SST dashboard API is ready for local development.",
    };
  }

  @Get("health")
  getHealth() {
    return {
      status: "ok",
      service: "sst-dashboard-api",
      checkedAt: new Date().toISOString(),
    };
  }
}
