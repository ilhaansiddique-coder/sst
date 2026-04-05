import Link from "next/link";

import { requestPasswordResetAction } from "@/app/actions/auth";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

function readQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export default function ForgotPasswordPage({
  searchParams,
}: Readonly<{
  searchParams?: Record<string, string | string[] | undefined>;
}>) {
  const errorMessage = readQueryValue(searchParams?.error);
  const noticeMessage = readQueryValue(searchParams?.notice);
  const initialEmail = readQueryValue(searchParams?.email);
  const previewUrl = readQueryValue(searchParams?.preview);

  return (
    <main className="auth-stage px-6 py-8 md:px-10 lg:px-14">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-6">
          <div className="auth-pill">Password recovery</div>
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Account rescue</p>
            <h1 className="font-display text-5xl leading-[0.95] text-ink md:text-6xl">
              Reset access without opening a support ticket.
            </h1>
            <p className="max-w-xl text-lg text-slate-700">
              We generate a time-limited reset link, expire the token on use, and re-issue a clean
              session after the password changes.
            </p>
          </div>

          {previewUrl ? (
            <div className="rounded-[28px] border border-dashed border-ink/20 bg-white/75 p-5">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Local preview</p>
              <p className="mt-3 text-sm text-slate-700">
                Dev mode is exposing the reset link directly so you can verify the lifecycle quickly.
              </p>
              <a href={previewUrl} className="mt-4 inline-flex font-semibold text-teal underline">
                Open reset link
              </a>
            </div>
          ) : null}
        </section>

        <section className="auth-card rounded-[36px] p-6 md:p-8">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Forgot password</p>
            <h2 className="font-display text-4xl text-ink">Request a fresh reset link</h2>
            <p className="text-sm text-slate-600">
              Remembered it?{" "}
              <Link href="/login" className="font-semibold text-teal underline decoration-teal/60">
                Return to sign in
              </Link>
            </p>
          </div>

          <form action={requestPasswordResetAction} className="mt-8 space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="auth-label">
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={initialEmail ?? ""}
                className="auth-input"
                placeholder="founder@company.com"
                required
              />
            </div>

            {noticeMessage ? (
              <p className="rounded-2xl border border-teal/20 bg-teal/10 px-4 py-3 text-sm text-teal">
                {noticeMessage}
              </p>
            ) : null}

            {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

            <AuthSubmitButton
              idleLabel="Send reset link"
              pendingLabel="Generating reset link..."
            />
          </form>
        </section>
      </div>
    </main>
  );
}
