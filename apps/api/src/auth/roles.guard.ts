import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { UserRole } from "@prisma/client";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

import { AuthService } from "./auth.service";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const session = await this.authService.requireSession(request);

    if (!requiredRoles.includes(session.role)) {
      throw new ForbiddenException("You do not have permission to perform this action.");
    }

    return true;
  }
}
