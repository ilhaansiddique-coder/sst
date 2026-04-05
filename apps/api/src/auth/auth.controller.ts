import { Body, Controller, Delete, Get, Inject, Param, Post, Req, UseGuards, UsePipes } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
  type RequestPasswordResetInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
} from "@sst/shared";

import { ZodValidationPipe } from "../common/zod.pipe";
import { AuthService } from "./auth.service";
import { SessionAuthGuard } from "./session-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

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
  @UseGuards(SessionAuthGuard)
  me(@Req() request: FastifyRequest) {
    return this.authService.getMe(request);
  }

  @Get("security")
  @UseGuards(SessionAuthGuard)
  security(@Req() request: FastifyRequest) {
    return this.authService.getSecurityOverview(request);
  }

  @Post("logout")
  @UseGuards(SessionAuthGuard)
  logout(@Req() request: FastifyRequest) {
    return this.authService.logout(request);
  }

  @Post("verify-email/request")
  @UseGuards(SessionAuthGuard)
  requestEmailVerification(@Req() request: FastifyRequest) {
    return this.authService.requestEmailVerification(request);
  }

  @Post("verify-email/confirm")
  @UsePipes(new ZodValidationPipe(verifyEmailSchema))
  verifyEmail(@Body() body: VerifyEmailInput, @Req() request: FastifyRequest) {
    return this.authService.verifyEmail(body, request);
  }

  @Post("password/forgot")
  @UsePipes(new ZodValidationPipe(requestPasswordResetSchema))
  requestPasswordReset(@Body() body: RequestPasswordResetInput, @Req() request: FastifyRequest) {
    return this.authService.requestPasswordReset(body, request);
  }

  @Post("password/reset")
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  resetPassword(@Body() body: ResetPasswordInput, @Req() request: FastifyRequest) {
    return this.authService.resetPassword(body, request);
  }

  @Post("password/change")
  @UseGuards(SessionAuthGuard)
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  changePassword(@Body() body: ChangePasswordInput, @Req() request: FastifyRequest) {
    return this.authService.changePassword(body, request);
  }

  @Delete("sessions/:sessionId")
  @UseGuards(SessionAuthGuard)
  revokeSession(@Param("sessionId") sessionId: string, @Req() request: FastifyRequest) {
    return this.authService.revokeSession(request, sessionId);
  }

  @Post("sessions/revoke-others")
  @UseGuards(SessionAuthGuard)
  revokeOtherSessions(@Req() request: FastifyRequest) {
    return this.authService.revokeOtherSessions(request);
  }
}
