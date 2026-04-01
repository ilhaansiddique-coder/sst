import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AnalyticsController } from "./analytics/analytics.controller";
import { AnalyticsService } from "./analytics/analytics.service";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { BillingController } from "./billing/billing.controller";
import { BillingService } from "./billing/billing.service";
import { ClickHouseService } from "./common/clickhouse.service";
import { PrismaService } from "./common/prisma.service";
import { RedisService } from "./common/redis.service";
import { ContainersController } from "./containers/containers.controller";
import { ContainersService } from "./containers/containers.service";
import { EventsController } from "./events/events.controller";
import { EventsService } from "./events/events.service";
import { GatewaysController } from "./gateways/gateways.controller";
import { GatewaysService } from "./gateways/gateways.service";
import { StoreController } from "./store/store.controller";
import { StoreService } from "./store/store.service";

@Module({
  controllers: [
    AppController,
    AnalyticsController,
    AuthController,
    BillingController,
    ContainersController,
    EventsController,
    GatewaysController,
    StoreController,
  ],
  providers: [
    AnalyticsService,
    AuthService,
    BillingService,
    ClickHouseService,
    ContainersService,
    EventsService,
    GatewaysService,
    PrismaService,
    RedisService,
    StoreService,
  ],
})
export class AppModule {}
