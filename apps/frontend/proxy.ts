import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AUTH_SESSION_COOKIE } from "@/lib/auth-constants";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;

  if (token) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const search = request.nextUrl.search;
  const destination = `${request.nextUrl.pathname}${search}`;
  loginUrl.searchParams.set("next", destination);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/containers/:path*",
    "/gateways/:path*",
    "/store/:path*",
    "/analytics/:path*",
    "/logs/:path*",
    "/settings/:path*",
  ],
};
