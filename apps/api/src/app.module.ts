import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AuthController } from "./auth/auth.controller";
import { ContainersController } from "./containers/containers.controller";

@Module({
  controllers: [AppController, AuthController, ContainersController],
})
export class AppModule {}
