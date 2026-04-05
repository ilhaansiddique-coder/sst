import "server-only";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { apiJson, type ApiJsonInit, ApiRequestError } from "@/lib/api";
import { AUTH_SESSION_COOKIE } from "@/lib/auth-constants";
import type { AuthViewer } from "@/lib/auth-types";

const isProduction = process.env.NODE_ENV === "production";

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(AUTH_SESSION_COOKIE)?.value;
}

export async function setSessionCookie(token: string, maxAge: number): Promise<void> {
  (await cookies()).set(AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(AUTH_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: 0,
  });
}

export async function fetchApi<T>(path: string, init: Omit<ApiJsonInit, "token"> = {}): Promise<T> {
  return apiJson<T>(path, {
    ...init,
    token: await getSessionToken(),
  });
}

export async function getCurrentViewer(options?: {
  tolerateErrors?: boolean;
}): Promise<AuthViewer | null> {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  try {
    return await apiJson<AuthViewer>("/auth/me", { token });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      return null;
    }

    if (options?.tolerateErrors) {
      return null;
    }

    throw error;
  }
}

export async function requireCurrentViewer(): Promise<AuthViewer> {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    redirect("/login");
  }

  return viewer;
}

export function getSafeRedirectPath(rawValue: FormDataEntryValue | null): Route {
  if (typeof rawValue !== "string" || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return "/dashboard";
  }

  return rawValue as Route;
}
