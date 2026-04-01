type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
};

export function getClientIp(request: RequestLike): string {
  const forwardedFor = request.headers?.["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0]?.trim() ?? request.ip ?? "unknown";
  }

  return request.ip ?? "unknown";
}

export function readBearerToken(request: RequestLike): string | undefined {
  const authorization = request.headers?.authorization;

  if (typeof authorization !== "string") {
    return undefined;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}
