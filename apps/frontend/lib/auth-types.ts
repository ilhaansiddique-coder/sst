export type UserRole = "owner" | "admin" | "member";

export type AuthAccount = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
};

export type AuthSessionToken = {
  tokenType: "Bearer";
  accessToken: string;
  expiresInSeconds: number;
  sessionId: string;
  issuedAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

export type AuthUser = {
  id: string;
  accountId: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLogin?: string | null;
  emailVerifiedAt?: string | null;
  passwordChangedAt?: string | null;
};

export type AuthResponse = {
  account: AuthAccount;
  user: AuthUser;
  session: AuthSessionToken;
  emailVerificationUrl?: string;
};

export type AuthViewer = {
  session: {
    sessionId: string;
    accountId: string;
    userId: string;
    role: UserRole;
    issuedAt: string;
    lastSeenAt: string;
    expiresAt: string;
  };
  account: AuthAccount;
  user: AuthUser & {
    lastLogin: string | null;
    emailVerifiedAt: string | null;
    passwordChangedAt: string | null;
  };
};

export type AuthSecuritySession = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
};

export type AuthAuditEvent = {
  id: string;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
};

export type AuthSecurityOverview = {
  currentSessionId: string;
  sessions: AuthSecuritySession[];
  auditEvents: AuthAuditEvent[];
};
