import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma, type AuthTokenType, type UserRole } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "@sst/shared";

import { createOpaqueToken, hashPassword, hashToken, verifyPassword } from "../common/crypto";
import { getApiEnv } from "../common/env";
import { PrismaService } from "../common/prisma.service";
import { getClientIp, getUserAgent, readBearerToken } from "../common/request";
import { RedisService } from "../common/redis.service";

type SessionPayload = {
  sessionId: string;
  userId: string;
  accountId: string;
  email: string;
  role: UserRole;
  issuedAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

type AuthenticatedRequest = FastifyRequest & {
  authSession?: SessionPayload;
};

type SessionIssuerUser = {
  id: string;
  email: string;
  role: UserRole;
};

type AccountSnapshot = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: Date;
};

type UserSnapshot = {
  id: string;
  accountId: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  lastLogin: Date | null;
  emailVerifiedAt: Date | null;
  passwordChangedAt: Date | null;
};

type IssuedSession = {
  tokenType: "Bearer";
  accessToken: string;
  expiresInSeconds: number;
  sessionId: string;
  issuedAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_TOUCH_WINDOW_MS = 1000 * 60 * 5;
const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60 * 24;
const PASSWORD_RESET_TTL_SECONDS = 60 * 60;
const AUTH_RATE_LIMIT = 25;
const AUTH_RATE_WINDOW_SECONDS = 60;
const SECURITY_AUDIT_LIMIT = 20;
const SECURITY_SESSION_LIMIT = 10;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async register(input: RegisterInput, request: FastifyRequest) {
    await this.assertRateLimit("sst:ratelimit:auth:register", getClientIp(request));

    const email = input.email.toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException("A user with this email already exists.");
    }

    const passwordHash = await hashPassword(input.password);
    const slug = await this.createUniqueAccountSlug(input.accountName);
    const now = new Date();

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
          email,
          passwordHash,
          role: "owner",
          passwordChangedAt: now,
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

    const session = await this.issueSession(created.user, created.account.id, request);
    const verification = await this.issueAuthToken(
      created.user.id,
      created.account.id,
      "email_verification",
      EMAIL_VERIFICATION_TTL_SECONDS,
    );

    await this.recordAuditEvent({
      eventType: "auth.registered",
      accountId: created.account.id,
      userId: created.user.id,
      request,
      metadata: {
        sessionId: session.sessionId,
      },
    });

    await this.recordAuditEvent({
      eventType: "auth.email_verification.sent",
      accountId: created.account.id,
      userId: created.user.id,
      request,
      metadata: {
        tokenType: "email_verification",
      },
    });

    return this.buildAuthResponse(
      this.serializeUser(created.user),
      this.serializeAccount(created.account),
      session,
      {
        emailVerificationUrl: verification.previewUrl,
      },
    );
  }

  async login(input: LoginInput, request: FastifyRequest) {
    await this.assertRateLimit("sst:ratelimit:auth:login", getClientIp(request));
    const email = input.email.toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { account: true },
    });

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const now = new Date();

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: now },
    });

    const session = await this.issueSession(user, user.accountId, request);

    await this.recordAuditEvent({
      eventType: "auth.logged_in",
      accountId: user.accountId,
      userId: user.id,
      request,
      metadata: {
        sessionId: session.sessionId,
      },
    });

    return this.buildAuthResponse(
      this.serializeUser({
        ...user,
        lastLogin: now,
      }),
      this.serializeAccount(user.account),
      session,
    );
  }

  async getMe(request: FastifyRequest) {
    const session = await this.requireSession(request);
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: { account: true },
    });

    if (!user) {
      await this.revokeSessionsByIds([session.sessionId]);
      throw new UnauthorizedException("Session user no longer exists.");
    }

    return {
      session: {
        sessionId: session.sessionId,
        accountId: session.accountId,
        userId: session.userId,
        role: session.role,
        issuedAt: session.issuedAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
      },
      account: this.serializeAccountResponse(this.serializeAccount(user.account)),
      user: this.serializeUserResponse(this.serializeUser(user)),
    };
  }

  async getSecurityOverview(request: FastifyRequest) {
    const session = await this.requireSession(request);
    const [sessions, auditEvents] = await Promise.all([
      this.prisma.userSession.findMany({
        where: {
          userId: session.userId,
          accountId: session.accountId,
        },
        orderBy: [{ revokedAt: "asc" }, { lastSeenAt: "desc" }],
        take: SECURITY_SESSION_LIMIT,
      }),
      this.prisma.authAuditEvent.findMany({
        where: {
          userId: session.userId,
          accountId: session.accountId,
        },
        orderBy: { createdAt: "desc" },
        take: SECURITY_AUDIT_LIMIT,
      }),
    ]);

    return {
      currentSessionId: session.sessionId,
      sessions: sessions.map((item) => ({
        id: item.id,
        ipAddress: item.ipAddress,
        userAgent: item.userAgent,
        createdAt: item.createdAt.toISOString(),
        lastSeenAt: item.lastSeenAt.toISOString(),
        expiresAt: item.expiresAt.toISOString(),
        revokedAt: item.revokedAt?.toISOString() ?? null,
        isCurrent: item.id === session.sessionId,
      })),
      auditEvents: auditEvents.map((item) => ({
        id: item.id,
        eventType: item.eventType,
        ipAddress: item.ipAddress,
        userAgent: item.userAgent,
        metadata: item.metadata,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async requestEmailVerification(request: FastifyRequest) {
    const session = await this.requireSession(request);
    await this.assertRateLimit("sst:ratelimit:auth:verify-email", getClientIp(request));

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      throw new UnauthorizedException("Session user no longer exists.");
    }

    if (user.emailVerifiedAt) {
      return {
        sent: false,
        alreadyVerified: true,
      };
    }

    const verification = await this.issueAuthToken(
      user.id,
      user.accountId,
      "email_verification",
      EMAIL_VERIFICATION_TTL_SECONDS,
    );

    await this.recordAuditEvent({
      eventType: "auth.email_verification.sent",
      accountId: user.accountId,
      userId: user.id,
      request,
      metadata: {
        tokenType: "email_verification",
      },
    });

    return {
      sent: true,
      alreadyVerified: false,
      emailVerificationUrl: verification.previewUrl,
    };
  }

  async verifyEmail(input: VerifyEmailInput, request: FastifyRequest) {
    await this.assertRateLimit("sst:ratelimit:auth:verify-email-confirm", getClientIp(request));

    const record = await this.consumeAuthToken("email_verification", input.token);
    const verifiedAt = new Date();

    const updatedUser = await this.prisma.user.update({
      where: { id: record.userId },
      data: {
        emailVerifiedAt: verifiedAt,
      },
      include: { account: true },
    });

    await this.recordAuditEvent({
      eventType: "auth.email_verified",
      accountId: updatedUser.accountId,
      userId: updatedUser.id,
      request,
      metadata: {
        verifiedAt: verifiedAt.toISOString(),
      },
    });

    return {
      verified: true,
      emailVerifiedAt: verifiedAt.toISOString(),
      account: this.serializeAccountResponse(this.serializeAccount(updatedUser.account)),
      user: this.serializeUserResponse(this.serializeUser(updatedUser)),
    };
  }

  async requestPasswordReset(input: RequestPasswordResetInput, request: FastifyRequest) {
    await this.assertRateLimit("sst:ratelimit:auth:password-reset", getClientIp(request));

    const email = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    let previewUrl: string | undefined;

    if (user) {
      const resetToken = await this.issueAuthToken(
        user.id,
        user.accountId,
        "password_reset",
        PASSWORD_RESET_TTL_SECONDS,
      );
      previewUrl = resetToken.previewUrl;

      await this.recordAuditEvent({
        eventType: "auth.password_reset.requested",
        accountId: user.accountId,
        userId: user.id,
        request,
        metadata: {
          tokenType: "password_reset",
        },
      });
    }

    return {
      accepted: true,
      passwordResetUrl: previewUrl,
    };
  }

  async resetPassword(input: ResetPasswordInput, request: FastifyRequest) {
    await this.assertRateLimit("sst:ratelimit:auth:password-reset-confirm", getClientIp(request));

    const tokenRecord = await this.consumeAuthToken("password_reset", input.token);
    const nextPasswordHash = await hashPassword(input.password);
    const now = new Date();

    const updatedUser = await this.prisma.user.update({
      where: { id: tokenRecord.userId },
      data: {
        passwordHash: nextPasswordHash,
        passwordChangedAt: now,
        lastLogin: now,
      },
      include: { account: true },
    });

    await this.revokeSessionsForUser(updatedUser.id);
    const session = await this.issueSession(updatedUser, updatedUser.accountId, request);

    await this.recordAuditEvent({
      eventType: "auth.password_reset.completed",
      accountId: updatedUser.accountId,
      userId: updatedUser.id,
      request,
      metadata: {
        sessionId: session.sessionId,
      },
    });

    return this.buildAuthResponse(
      this.serializeUser(updatedUser),
      this.serializeAccount(updatedUser.account),
      session,
    );
  }

  async changePassword(input: ChangePasswordInput, request: FastifyRequest) {
    const session = await this.requireSession(request);
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: { account: true },
    });

    if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    if (await verifyPassword(input.newPassword, user.passwordHash)) {
      throw new BadRequestException("Choose a new password that differs from the current password.");
    }

    const now = new Date();
    const nextPasswordHash = await hashPassword(input.newPassword);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: nextPasswordHash,
        passwordChangedAt: now,
        lastLogin: now,
      },
      include: { account: true },
    });

    await this.revokeSessionsForUser(updatedUser.id);
    const nextSession = await this.issueSession(updatedUser, updatedUser.accountId, request);

    await this.recordAuditEvent({
      eventType: "auth.password_changed",
      accountId: updatedUser.accountId,
      userId: updatedUser.id,
      request,
      metadata: {
        sessionId: nextSession.sessionId,
      },
    });

    return this.buildAuthResponse(
      this.serializeUser(updatedUser),
      this.serializeAccount(updatedUser.account),
      nextSession,
    );
  }

  async revokeSession(request: FastifyRequest, sessionId: string) {
    const session = await this.requireSession(request);
    const target = await this.prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId: session.userId,
        accountId: session.accountId,
      },
    });

    if (!target) {
      return {
        revoked: false,
        currentSessionRevoked: false,
      };
    }

    await this.revokeSessionsByIds([target.id]);

    await this.recordAuditEvent({
      eventType: "auth.session_revoked",
      accountId: session.accountId,
      userId: session.userId,
      request,
      metadata: {
        sessionId: target.id,
      },
    });

    return {
      revoked: true,
      currentSessionRevoked: target.id === session.sessionId,
    };
  }

  async revokeOtherSessions(request: FastifyRequest) {
    const session = await this.requireSession(request);
    const revokedCount = await this.revokeSessionsForUser(session.userId, session.sessionId);

    await this.recordAuditEvent({
      eventType: "auth.other_sessions_revoked",
      accountId: session.accountId,
      userId: session.userId,
      request,
      metadata: {
        preservedSessionId: session.sessionId,
        revokedCount,
      },
    });

    return {
      revokedCount,
    };
  }

  async logout(request: FastifyRequest) {
    const token = readBearerToken(request);

    if (!token) {
      return { loggedOut: false };
    }

    const session = await this.getOptionalSession(request);
    const tokenHash = hashToken(token);

    await this.redis.client.del(this.getSessionKeyFromHash(tokenHash));

    if (session) {
      await this.prisma.userSession.updateMany({
        where: { id: session.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.recordAuditEvent({
        eventType: "auth.logged_out",
        accountId: session.accountId,
        userId: session.userId,
        request,
        metadata: {
          sessionId: session.sessionId,
        },
      });
    }

    return { loggedOut: true };
  }

  async getOptionalSession(request: FastifyRequest): Promise<SessionPayload | undefined> {
    const attachedSession = (request as AuthenticatedRequest).authSession;

    if (attachedSession) {
      return attachedSession;
    }

    const token = readBearerToken(request);

    if (!token) {
      return undefined;
    }

    const tokenHash = hashToken(token);
    const rawSession = await this.redis.client.get(this.getSessionKeyFromHash(tokenHash));

    if (!rawSession) {
      return undefined;
    }

    let session: SessionPayload;

    try {
      session = JSON.parse(rawSession) as SessionPayload;
    } catch {
      await this.redis.client.del(this.getSessionKeyFromHash(tokenHash));
      return undefined;
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await this.revokeSessionsByIds([session.sessionId]);
      return undefined;
    }

    const nextSession = await this.touchSession(tokenHash, session);
    (request as AuthenticatedRequest).authSession = nextSession;
    return nextSession;
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
    const session = await this.getOptionalSession(request);

    if (!session) {
      return undefined;
    }

    const requestedAccountId = this.readRequestedAccountId(request, explicitAccountId);

    if (requestedAccountId && requestedAccountId !== session.accountId) {
      throw new ForbiddenException("The requested account does not match your active session.");
    }

    return session.accountId;
  }

  async requireAccountId(request: FastifyRequest, explicitAccountId?: string): Promise<string> {
    const accountId = await this.resolveAccountId(request, explicitAccountId);

    if (!accountId) {
      throw new UnauthorizedException("A valid session is required for this operation.");
    }

    return accountId;
  }

  async requireRole(request: FastifyRequest, roles: UserRole[]): Promise<SessionPayload> {
    const session = await this.requireSession(request);

    if (!roles.includes(session.role)) {
      throw new ForbiddenException("You do not have permission to perform this action.");
    }

    return session;
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
    user: SessionIssuerUser,
    accountId: string,
    request: FastifyRequest,
  ): Promise<IssuedSession> {
    const accessToken = createOpaqueToken();
    const tokenHash = hashToken(accessToken);
    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
    const payload: SessionPayload = {
      sessionId,
      userId: user.id,
      accountId,
      email: user.email,
      role: user.role,
      issuedAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        accountId,
        tokenHash,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        lastSeenAt: now,
        expiresAt,
      },
    });

    try {
      await this.redis.client.set(
        this.getSessionKeyFromHash(tokenHash),
        JSON.stringify(payload),
        "EX",
        SESSION_TTL_SECONDS,
      );
    } catch (error) {
      await this.prisma.userSession.deleteMany({
        where: { id: sessionId },
      });
      throw error;
    }

    return {
      tokenType: "Bearer",
      accessToken,
      expiresInSeconds: SESSION_TTL_SECONDS,
      sessionId,
      issuedAt: payload.issuedAt,
      lastSeenAt: payload.lastSeenAt,
      expiresAt: payload.expiresAt,
    };
  }

  private async issueAuthToken(
    userId: string,
    accountId: string,
    type: AuthTokenType,
    ttlSeconds: number,
  ) {
    const now = new Date();
    const token = createOpaqueToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    await this.prisma.$transaction([
      this.prisma.authToken.updateMany({
        where: {
          userId,
          type,
          consumedAt: null,
        },
        data: {
          consumedAt: now,
        },
      }),
      this.prisma.authToken.create({
        data: {
          userId,
          accountId,
          type,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    return {
      token,
      previewUrl: this.isPreviewMode()
        ? this.buildActionUrl(type === "email_verification" ? "verify-email" : "reset-password", token)
        : undefined,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async consumeAuthToken(type: AuthTokenType, token: string) {
    const tokenHash = hashToken(token);
    const record = await this.prisma.authToken.findFirst({
      where: {
        type,
        tokenHash,
        consumedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("This security link is invalid or has expired.");
    }

    await this.prisma.authToken.update({
      where: { id: record.id },
      data: {
        consumedAt: new Date(),
      },
    });

    return record;
  }

  private async touchSession(tokenHash: string, session: SessionPayload): Promise<SessionPayload> {
    const now = Date.now();
    const lastSeenAt = new Date(session.lastSeenAt).getTime();

    if (Number.isNaN(lastSeenAt) || now - lastSeenAt >= SESSION_TOUCH_WINDOW_MS) {
      const nextExpiresAt = new Date(now + SESSION_TTL_SECONDS * 1000);
      const nextSession: SessionPayload = {
        ...session,
        lastSeenAt: new Date(now).toISOString(),
        expiresAt: nextExpiresAt.toISOString(),
      };

      const updated = await this.prisma.userSession.updateMany({
        where: {
          id: session.sessionId,
          revokedAt: null,
        },
        data: {
          lastSeenAt: new Date(now),
          expiresAt: nextExpiresAt,
        },
      });

      if (updated.count === 0) {
        await this.redis.client.del(this.getSessionKeyFromHash(tokenHash));
        throw new UnauthorizedException("Session has been revoked.");
      }

      await this.redis.client.set(
        this.getSessionKeyFromHash(tokenHash),
        JSON.stringify(nextSession),
        "EX",
        SESSION_TTL_SECONDS,
      );

      return nextSession;
    }

    await this.redis.client.expire(this.getSessionKeyFromHash(tokenHash), SESSION_TTL_SECONDS);
    return session;
  }

  private async revokeSessionsForUser(userId: string, exceptSessionId?: string): Promise<number> {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      select: {
        id: true,
        tokenHash: true,
      },
    });

    if (sessions.length === 0) {
      return 0;
    }

    await this.prisma.userSession.updateMany({
      where: {
        id: {
          in: sessions.map((item) => item.id),
        },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.redis.client.del(...sessions.map((item) => this.getSessionKeyFromHash(item.tokenHash)));

    return sessions.length;
  }

  private async revokeSessionsByIds(sessionIds: string[]) {
    if (sessionIds.length === 0) {
      return;
    }

    const sessions = await this.prisma.userSession.findMany({
      where: {
        id: {
          in: sessionIds,
        },
      },
      select: {
        id: true,
        tokenHash: true,
      },
    });

    if (sessions.length === 0) {
      return;
    }

    await this.prisma.userSession.updateMany({
      where: {
        id: {
          in: sessions.map((item) => item.id),
        },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.redis.client.del(...sessions.map((item) => this.getSessionKeyFromHash(item.tokenHash)));
  }

  private async recordAuditEvent(input: {
    eventType: string;
    accountId?: string;
    userId?: string;
    request?: FastifyRequest;
    metadata?: Record<string, unknown>;
  }) {
    await this.prisma.authAuditEvent.create({
      data: {
        eventType: input.eventType,
        accountId: input.accountId,
        userId: input.userId,
        ipAddress: input.request ? getClientIp(input.request) : undefined,
        userAgent: input.request ? getUserAgent(input.request) : undefined,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  private buildAuthResponse(
    user: UserSnapshot,
    account: AccountSnapshot,
    session: IssuedSession,
    extras?: {
      emailVerificationUrl?: string;
    },
  ) {
    return {
      account: this.serializeAccountResponse(account),
      user: this.serializeUserResponse(user),
      session,
      emailVerificationUrl: extras?.emailVerificationUrl,
    };
  }

  private serializeAccount(account: {
    id: string;
    name: string;
    slug: string;
    plan: { toString(): string } | string;
    createdAt: Date;
  }): AccountSnapshot {
    return {
      id: account.id,
      name: account.name,
      slug: account.slug,
      plan: account.plan.toString(),
      createdAt: account.createdAt,
    };
  }

  private serializeUser(user: {
    id: string;
    accountId: string;
    email: string;
    role: UserRole;
    createdAt: Date;
    lastLogin: Date | null;
    emailVerifiedAt: Date | null;
    passwordChangedAt: Date | null;
  }): UserSnapshot {
    return {
      id: user.id,
      accountId: user.accountId,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      emailVerifiedAt: user.emailVerifiedAt,
      passwordChangedAt: user.passwordChangedAt,
    };
  }

  private serializeAccountResponse(account: AccountSnapshot) {
    return {
      id: account.id,
      name: account.name,
      slug: account.slug,
      plan: account.plan,
      createdAt: account.createdAt.toISOString(),
    };
  }

  private serializeUserResponse(user: UserSnapshot) {
    return {
      id: user.id,
      accountId: user.accountId,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      lastLogin: user.lastLogin?.toISOString() ?? null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
    };
  }

  private getSessionKey(token: string): string {
    return this.getSessionKeyFromHash(hashToken(token));
  }

  private getSessionKeyFromHash(tokenHash: string): string {
    return `sst:session:${tokenHash}`;
  }

  private buildActionUrl(pathname: "verify-email" | "reset-password", token: string): string {
    const appUrl = getApiEnv().APP_URL.replace(/\/$/, "");
    return `${appUrl}/${pathname}?token=${encodeURIComponent(token)}`;
  }

  private isPreviewMode(): boolean {
    return process.env.NODE_ENV !== "production";
  }

  private readRequestedAccountId(
    request: FastifyRequest,
    explicitAccountId?: string,
  ): string | undefined {
    if (explicitAccountId) {
      return explicitAccountId;
    }

    const headerValue = request.headers["x-account-id"];
    return typeof headerValue === "string" && headerValue.length > 0 ? headerValue : undefined;
  }
}
