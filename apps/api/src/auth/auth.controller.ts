import { Body, Controller, Get, Post, Req, UsePipes } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@sst/shared";

import { ZodValidationPipe } from "../common/zod.pipe";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() body: RegisterInput, @Req() request: FastifyRequest) {
    return this.authService.register(body, request);
  }

  @Post("login")
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: LoginInput, @Req() request: FastifyRequest) {
    return this.authService.login(body, request);
  }

  @Get("me")
  me(@Req() request: FastifyRequest) {
    return this.authService.getMe(request);
  }

  @Post("logout")
  logout(@Req() request: FastifyRequest) {
    return this.authService.logout(request);
  }
}
