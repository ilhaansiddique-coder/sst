export const AUTH_SESSION_COOKIE = "sst.session";

export const protectedRouteMatchers = [
  "/dashboard",
  "/containers",
  "/gateways",
  "/store",
  "/analytics",
  "/logs",
  "/settings",
] as const;
