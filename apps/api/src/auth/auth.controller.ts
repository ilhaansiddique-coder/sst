import { Body, Controller, Post, UsePipes } from "@nestjs/common";

import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@sst/shared";

import { ZodValidationPipe } from "../common/zod.pipe";

@Controller("auth")
export class AuthController {
  @Post("register")
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() body: RegisterInput) {
    return {
      message: "Registration endpoint scaffolded.",
      account: {
        name: body.accountName,
        email: body.email,
      },
      nextStep: "Persist account and user records via Prisma.",
    };
  }

  @Post("login")
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: LoginInput) {
    return {
      message: "Login endpoint scaffolded.",
      email: body.email,
      tokenType: "Bearer",
      accessToken: "dev-token-placeholder",
    };
  }
}
