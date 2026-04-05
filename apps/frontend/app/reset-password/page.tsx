import Link from "next/link";

import { resetPasswordAction } from "@/app/actions/auth";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { PasswordField } from "@/components/auth/password-field";

function readQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export default function ResetPasswordPage({
  searchParams,
}: Readonly<{
  searchParams?: Record<string, string | string[] | undefined>;
}>) {
  const token = readQueryValue(searchParams?.token);
  const errorMessage = readQueryValue(searchParams?.error);

  return (
    <main className="auth-stage px-6 py-8 md:px-10 lg:px-14">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-10 lg:grid-cols-[1fr_1fr]">
        <section className="space-y-6">
          <div className="auth-pill">Password rotation</div>
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Fresh credentials</p>
            <h1 className="font-display text-5xl leading-[0.95] text-ink md:text-6xl">
              Set a stronger password and mint a clean session.
            </h1>
            <p className="max-w-xl text-lg text-slate-700">
              Reset links are single-use, time-limited, and they revoke older sessions before
              re-entry.
            </p>
          </div>
        </section>

        <section className="auth-card rounded-[36px] p-6 md:p-8">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Reset password</p>
            <h2 className="font-display text-4xl text-ink">Choose a new secret</h2>
            <p className="text-sm text-slate-600">
              Need a fresh link?{" "}
              <Link
                href="/forgot-password"
                className="font-semibold text-teal underline decoration-teal/60"
              >
                Request another reset email
              </Link>
            </p>
          </div>

          {token ? (
            <form action={resetPasswordAction} className="mt-8 space-y-4">
              <input type="hidden" name="token" value={token} />

              <PasswordField
                id="password"
                name="password"
                label="New password"
                autoComplete="new-password"
                placeholder="Minimum 12 characters"
                required
              />

              <PasswordField
                id="confirmPassword"
                name="confirmPassword"
                label="Confirm new password"
                autoComplete="new-password"
                placeholder="Repeat your new password"
                required
              />

              <p className="text-xs text-slate-500">
                Use at least 12 characters with uppercase, lowercase, a number, and a symbol.
              </p>

              {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

              <AuthSubmitButton idleLabel="Reset password" pendingLabel="Updating password..." />
            </form>
          ) : (
            <div className="mt-8 rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              This reset link is missing a token. Request a new one to continue safely.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
