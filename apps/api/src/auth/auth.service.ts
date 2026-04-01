import { randomUUID } from "node:crypto";

import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { UserRole } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import type { LoginInput, RegisterInput } from "@sst/shared";

import { hashPassword, createOpaqueToken, hashToken, verifyPassword } from "../common/crypto";
import { PrismaService } from "../common/prisma.service";
import { getClientIp, readBearerToken } from "../common/request";
import { RedisService } from "../common/redis.service";

type SessionPayload = {
  sessionId: string;
  userId: string;
  accountId: string;
  email: string;
  role: UserRole;
  issuedAt: string;
};

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const AUTH_RATE_LIMIT = 25;
const AUTH_RATE_WINDOW_SECONDS = 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async register(input: RegisterInput, request: FastifyRequest) {
    await this.assertRateLimit("sst:ratelimit:auth:register", getClientIp(request));

    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException("A user with this email already exists.");
    }

    const passwordHash = await hashPassword(input.password);
    const slug = await this.createUniqueAccountSlug(input.accountName);

    const created = await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: input.accountName,
          slug,
        },
      });

      const user = await tx.user.create({
        data: {
          accountId: account.id,
          email: input.email.toLowerCase(),
          passwordHash,
          role: "owner",
        },
      });

      await tx.subscription.create({
        data: {
          accountId: account.id,
          plan: "hobby",
          status: "trialing",
        },
      });

      return { account, user };
    });

    const session = await this.issueSession(created.user, created.account.id);

    return {
      account: {
        id: created.account.id,
        name: created.account.name,
        slug: created.account.slug,
        plan: created.account.plan,
        createdAt: created.account.createdAt.toISOString(),
      },
      user: {
        id: created.user.id,
        accountId: created.user.accountId,
        email: created.user.email,
        role: created.user.role,
        createdAt: created.user.createdAt.toISOString(),
      },
      session,
    };
  }

  async login(input: LoginInput, request: FastifyRequest) {
    await this.assertRateLimit("sst:ratelimit:auth:login", getClientIp(request));

    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { account: true },
    });

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const session = await this.issueSession(user, user.accountId);

    return {
      account: {
        id: user.account.id,
        name: user.account.name,
        slug: user.account.slug,
        plan: user.account.plan,
        createdAt: user.account.createdAt.toISOString(),
      },
      user: {
        id: user.id,
        accountId: user.accountId,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      session,
    };
  }

  async getMe(request: FastifyRequest) {
    const session = await this.requireSession(request);
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: { account: true },
    });

    if (!user) {
      throw new UnauthorizedException("Session user no longer exists.");
    }

    return {
      session: {
        accountId: session.accountId,
        userId: session.userId,
        role: session.role,
        issuedAt: session.issuedAt,
      },
      account: {
        id: user.account.id,
        name: user.account.name,
        slug: user.account.slug,
        plan: user.account.plan,
        createdAt: user.account.createdAt.toISOString(),
      },
      user: {
        id: user.id,
        accountId: user.accountId,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        lastLogin: user.lastLogin?.toISOString() ?? null,
      },
    };
  }

  async logout(request: FastifyRequest) {
    const token = readBearerToken(request);

    if (!token) {
      return { loggedOut: false };
    }

    await this.redis.client.del(this.getSessionKey(token));
    return { loggedOut: true };
  }

  async getOptionalSession(request: FastifyRequest): Promise<SessionPayload | undefined> {
    const token = readBearerToken(request);

    if (!token) {
      return undefined;
    }

    const rawSession = await this.redis.client.get(this.getSessionKey(token));
    return rawSession ? (JSON.parse(rawSession) as SessionPayload) : undefined;
  }

  async requireSession(request: FastifyRequest): Promise<SessionPayload> {
    const session = await this.getOptionalSession(request);

    if (!session) {
      throw new UnauthorizedException("A valid session is required for this operation.");
    }

    return session;
  }

  async resolveAccountId(
    request: FastifyRequest,
    explicitAccountId?: string,
  ): Promise<string | undefined> {
    if (explicitAccountId) {
      return explicitAccountId;
    }

    const headerValue = request.headers["x-account-id"];

    if (typeof headerValue === "string" && headerValue.length > 0) {
      return headerValue;
    }

    const session = await this.getOptionalSession(request);
    return session?.accountId;
  }

  async requireAccountId(request: FastifyRequest, explicitAccountId?: string): Promise<string> {
    const accountId = await this.resolveAccountId(request, explicitAccountId);

    if (!accountId) {
      throw new UnauthorizedException("Provide a bearer session or accountId for this operation.");
    }

    return accountId;
  }

  private async assertRateLimit(prefix: string, subject: string): Promise<void> {
    const bucket = Math.floor(Date.now() / (AUTH_RATE_WINDOW_SECONDS * 1000));
    const key = `${prefix}:${subject}:${bucket}`;
    const count = await this.redis.client.incr(key);

    if (count === 1) {
      await this.redis.client.expire(key, AUTH_RATE_WINDOW_SECONDS);
    }

    if (count > AUTH_RATE_LIMIT) {
      throw new HttpException(
        "Too many authentication attempts. Please try again soon.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async createUniqueAccountSlug(accountName: string): Promise<string> {
    const baseSlug =
      accountName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "account";

    let attempt = 0;

    while (attempt < 20) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      const existing = await this.prisma.account.findUnique({ where: { slug } });

      if (!existing) {
        return slug;
      }

      attempt += 1;
    }

    throw new ConflictException("Could not generate a unique account slug.");
  }

  private async issueSession(
    user: { id: string; email: string; role: UserRole },
    accountId: string,
  ) {
    const accessToken = createOpaqueToken();
    const payload: SessionPayload = {
      sessionId: randomUUID(),
      userId: user.id,
      accountId,
      email: user.email,
      role: user.role,
      issuedAt: new Date().toISOString(),
    };

    await this.redis.client.set(
      this.getSessionKey(accessToken),
      JSON.stringify(payload),
      "EX",
      SESSION_TTL_SECONDS,
    );

    return {
      tokenType: "Bearer",
      accessToken,
      expiresInSeconds: SESSION_TTL_SECONDS,
    };
  }

  private getSessionKey(token: string): string {
    return `sst:session:${hashToken(token)}`;
  }
}
