import Link from "next/link";

import { resendVerificationAction, verifyEmailAction } from "@/app/actions/auth";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

function readQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export default function VerifyEmailPage({
  searchParams,
}: Readonly<{
  searchParams?: Record<string, string | string[] | undefined>;
}>) {
  const token = readQueryValue(searchParams?.token);
  const nextPath =
    typeof searchParams?.next === "string" && searchParams.next.startsWith("/")
      ? searchParams.next
      : "/dashboard";
  const previewUrl = readQueryValue(searchParams?.preview);
  const errorMessage = readQueryValue(searchParams?.error);
  const noticeMessage = readQueryValue(searchParams?.notice);
  const email = readQueryValue(searchParams?.email);

  return (
    <main className="auth-stage px-6 py-8 md:px-10 lg:px-14">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-6">
          <div className="auth-pill">Email verification</div>
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Trust the owner</p>
            <h1 className="font-display text-5xl leading-[0.95] text-ink md:text-6xl">
              Confirm the inbox behind this workspace.
            </h1>
            <p className="max-w-xl text-lg text-slate-700">
              Verification links are single-use, time-limited, and tracked in the security audit log.
            </p>
          </div>

          {previewUrl ? (
            <div className="rounded-[28px] border border-dashed border-ink/20 bg-white/75 p-5">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Local preview</p>
              <p className="mt-3 text-sm text-slate-700">
                Dev mode is exposing the verification link directly so you can test the full auth
                lifecycle without waiting on email delivery setup.
              </p>
              <a href={previewUrl} className="mt-4 inline-flex font-semibold text-teal underline">
                Open verification link
              </a>
            </div>
          ) : null}
        </section>

        <section className="auth-card rounded-[36px] p-6 md:p-8">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Confirm address</p>
            <h2 className="font-display text-4xl text-ink">Finish the trust handshake</h2>
            <p className="text-sm text-slate-600">
              {email ? `Verifying ${email}. ` : null}
              Want to sign in first?{" "}
              <Link href="/login" className="font-semibold text-teal underline decoration-teal/60">
                Open login
              </Link>
            </p>
          </div>

          {noticeMessage ? (
            <p className="mt-6 rounded-2xl border border-teal/20 bg-teal/10 px-4 py-3 text-sm text-teal">
              {noticeMessage}
            </p>
          ) : null}

          {errorMessage ? <p className="mt-6 auth-error">{errorMessage}</p> : null}

          {token ? (
            <form action={verifyEmailAction} className="mt-8 space-y-4">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="next" value={nextPath} />
              <AuthSubmitButton idleLabel="Verify email" pendingLabel="Confirming email..." />
            </form>
          ) : (
            <form action={resendVerificationAction} className="mt-8 space-y-4">
              <input type="hidden" name="next" value={nextPath} />
              <AuthSubmitButton
                idleLabel="Generate fresh verification link"
                pendingLabel="Generating verification link..."
              />
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
