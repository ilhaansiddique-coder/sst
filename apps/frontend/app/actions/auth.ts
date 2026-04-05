"use server";

import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@sst/shared";
import { redirect as nextRedirect } from "next/navigation";

// Next.js 16 uses strict route types. Our dynamic redirects build paths at runtime.
function redirect(path: string): never {
  // @ts-expect-error -- dynamic path string is not a static Route type
  return nextRedirect(path);
}

import { clearSessionCookie, getSafeRedirectPath, getSessionToken, setSessionCookie } from "@/lib/auth";
import { apiJson, ApiRequestError } from "@/lib/api";
import type { AuthResponse } from "@/lib/auth-types";

export async function loginAction(
  formData: FormData,
): Promise<never> {
  const nextPath = getSafeRedirectPath(formData.get("next"));
  const payload = {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    return redirectToAuthScreen("/login", nextPath, {
      error: parsed.error.issues[0]?.message ?? "Please check your login details and try again.",
      fields: {
        email: payload.email,
      },
    });
  }

  try {
    const result = await apiJson<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });

    await setSessionCookie(result.session.accessToken, result.session.expiresInSeconds);

    if (!result.user.emailVerifiedAt) {
      redirect(buildRedirectUrl("/verify-email", { next: nextPath as string }));
    }
  } catch (error) {
    return redirectToAuthScreen("/login", nextPath, {
      error: getActionErrorMessage(error, "We couldn't sign you in just yet."),
      fields: {
        email: payload.email,
      },
    });
  }

  redirect(nextPath);
}

export async function registerAction(
  formData: FormData,
): Promise<never> {
  const nextPath = getSafeRedirectPath(formData.get("next"));
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const payload = {
    accountName: String(formData.get("accountName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };

  if (payload.password !== confirmPassword) {
    return redirectToAuthScreen("/register", nextPath, {
      error: "Password confirmation does not match.",
      fields: {
        accountName: payload.accountName,
        email: payload.email,
      },
    });
  }

  const parsed = registerSchema.safeParse(payload);

  if (!parsed.success) {
    return redirectToAuthScreen("/register", nextPath, {
      error: parsed.error.issues[0]?.message ?? "Please check your details and try again.",
      fields: {
        accountName: payload.accountName,
        email: payload.email,
      },
    });
  }

  try {
    const result = await apiJson<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });

    await setSessionCookie(result.session.accessToken, result.session.expiresInSeconds);

    redirect(
      buildRedirectUrl("/verify-email", {
        next: nextPath,
        email: result.user.email,
        preview: result.emailVerificationUrl,
      }),
    );
  } catch (error) {
    return redirectToAuthScreen("/register", nextPath, {
      error: getActionErrorMessage(error, "We couldn't create your account right now."),
      fields: {
        accountName: payload.accountName,
        email: payload.email,
      },
    });
  }

  redirect(nextPath);
}

export async function resendVerificationAction(formData: FormData): Promise<never> {
  const nextPath = getSafeRedirectPath(formData.get("next"));
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  try {
    const result = await apiJson<{ alreadyVerified?: boolean; emailVerificationUrl?: string }>(
      "/auth/verify-email/request",
      {
        method: "POST",
        token,
      },
    );

    redirect(
      buildRedirectUrl("/verify-email", {
        next: nextPath,
        preview: result.emailVerificationUrl,
        notice: result.alreadyVerified
          ? "Your email is already verified."
          : "A fresh verification link is ready.",
      }),
    );
  } catch (error) {
    redirect(
      buildRedirectUrl("/verify-email", {
        next: nextPath,
        error: getActionErrorMessage(error, "We couldn't generate a new verification link."),
      }),
    );
  }
}

export async function verifyEmailAction(formData: FormData): Promise<never> {
  const nextPath = getSafeRedirectPath(formData.get("next"));
  const tokenValue = String(formData.get("token") ?? "");
  const parsed = verifyEmailSchema.safeParse({ token: tokenValue });

  if (!parsed.success) {
    redirect(
      buildRedirectUrl("/verify-email", {
        next: nextPath,
        error: parsed.error.issues[0]?.message ?? "That verification link looks invalid.",
      }),
    );
  }

  try {
    await apiJson("/auth/verify-email/confirm", {
      method: "POST",
      token: await getSessionToken(),
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    redirect(
      buildRedirectUrl("/verify-email", {
        next: nextPath,
        error: getActionErrorMessage(error, "We couldn't verify this email link."),
      }),
    );
  }

  redirect(buildRedirectUrl(nextPath, { notice: "Email verified. Your workspace is fully active." }));
}

export async function requestPasswordResetAction(formData: FormData): Promise<never> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = requestPasswordResetSchema.safeParse({ email });

  if (!parsed.success) {
    redirect(
      buildRedirectUrl("/forgot-password", {
        error: parsed.error.issues[0]?.message ?? "Please enter a valid work email.",
        email,
      }),
    );
  }

  try {
    const result = await apiJson<{ passwordResetUrl?: string }>("/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });

    redirect(
      buildRedirectUrl("/forgot-password", {
        notice: "If that account exists, a reset link is now ready.",
        email,
        preview: result.passwordResetUrl,
      }),
    );
  } catch (error) {
    redirect(
      buildRedirectUrl("/forgot-password", {
        error: getActionErrorMessage(error, "We couldn't start the reset flow right now."),
        email,
      }),
    );
  }
}

export async function resetPasswordAction(formData: FormData): Promise<never> {
  const tokenValue = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password !== confirmPassword) {
    redirect(
      buildRedirectUrl("/reset-password", {
        token: tokenValue,
        error: "Password confirmation does not match.",
      }),
    );
  }

  const parsed = resetPasswordSchema.safeParse({
    token: tokenValue,
    password,
  });

  if (!parsed.success) {
    redirect(
      buildRedirectUrl("/reset-password", {
        token: tokenValue,
        error: parsed.error.issues[0]?.message ?? "Please choose a stronger password.",
      }),
    );
  }

  try {
    const result = await apiJson<AuthResponse>("/auth/password/reset", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });

    await setSessionCookie(result.session.accessToken, result.session.expiresInSeconds);
  } catch (error) {
    redirect(
      buildRedirectUrl("/reset-password", {
        token: tokenValue,
        error: getActionErrorMessage(error, "We couldn't reset your password."),
      }),
    );
  }

  redirect(buildRedirectUrl("/dashboard", { notice: "Password updated and session refreshed." }));
}

export async function changePasswordAction(formData: FormData): Promise<never> {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) {
    redirect(buildRedirectUrl("/settings", { error: "New password confirmation does not match." }));
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword,
    newPassword,
  });

  if (!parsed.success) {
    redirect(
      buildRedirectUrl("/settings", {
        error: parsed.error.issues[0]?.message ?? "Please review your password change details.",
      }),
    );
  }

  try {
    const result = await apiJson<AuthResponse>("/auth/password/change", {
      method: "POST",
      token,
      body: JSON.stringify(parsed.data),
    });

    await setSessionCookie(result.session.accessToken, result.session.expiresInSeconds);
  } catch (error) {
    redirect(
      buildRedirectUrl("/settings", {
        error: getActionErrorMessage(error, "We couldn't update your password."),
      }),
    );
  }

  redirect(buildRedirectUrl("/settings", { notice: "Password updated. Other sessions were signed out." }));
}

export async function revokeSessionAction(formData: FormData): Promise<never> {
  const token = await getSessionToken();
  const sessionId = String(formData.get("sessionId") ?? "");

  if (!token) {
    redirect("/login");
  }

  try {
    const result = await apiJson<{ currentSessionRevoked?: boolean }>(`/auth/sessions/${sessionId}`, {
      method: "DELETE",
      token,
    });

    if (result.currentSessionRevoked) {
      await clearSessionCookie();
      redirect("/login");
    }
  } catch (error) {
    redirect(
      buildRedirectUrl("/settings", {
        error: getActionErrorMessage(error, "We couldn't revoke that session."),
      }),
    );
  }

  redirect(buildRedirectUrl("/settings", { notice: "Session revoked." }));
}

export async function revokeOtherSessionsAction(): Promise<never> {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  try {
    await apiJson("/auth/sessions/revoke-others", {
      method: "POST",
      token,
    });
  } catch (error) {
    redirect(
      buildRedirectUrl("/settings", {
        error: getActionErrorMessage(error, "We couldn't sign out your other sessions."),
      }),
    );
  }

  redirect(buildRedirectUrl("/settings", { notice: "Other sessions signed out." }));
}

export async function logoutAction(): Promise<never> {
  const token = await getSessionToken();

  if (token) {
    try {
      await apiJson("/auth/logout", {
        method: "POST",
        token,
      });
    } catch {
      // We still clear the frontend cookie so the session is torn down locally.
    }
  }

  await clearSessionCookie();
  redirect("/login");
}

function getActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function redirectToAuthScreen(
  pathname: "/login" | "/register",
  nextPath: string,
  input: {
    error: string;
    fields?: Record<string, string>;
  },
): never {
  const params = new URLSearchParams();
  params.set("next", nextPath);
  params.set("error", input.error);

  for (const [key, value] of Object.entries(input.fields ?? {})) {
    if (value.trim().length > 0) {
      params.set(key, value);
    }
  }

  redirect(buildRedirectUrl(pathname, Object.fromEntries(params.entries())));
}

function buildRedirectUrl(
  pathname: string,
  paramsInput: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(paramsInput)) {
    if (typeof value === "string" && value.trim().length > 0) {
      params.set(key, value);
    }
  }

  const suffix = params.toString();
  return suffix.length > 0 ? `${pathname}?${suffix}` : pathname;
}
