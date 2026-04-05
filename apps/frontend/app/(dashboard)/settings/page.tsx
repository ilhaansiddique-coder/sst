import {
  changePasswordAction,
  resendVerificationAction,
  revokeOtherSessionsAction,
  revokeSessionAction,
} from "@/app/actions/auth";
import { PasswordField } from "@/components/auth/password-field";
import { SecurityOverview } from "@/components/auth/security-overview";
import { PageHeader } from "@/components/page-header";
import { fetchApi } from "@/lib/auth";
import type { AuthSecurityOverview } from "@/lib/auth-types";

function readQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleString();
}

export default async function SettingsPage({
  searchParams,
}: Readonly<{
  searchParams?: Record<string, string | string[] | undefined>;
}>) {
  const security = await fetchApi<AuthSecurityOverview>("/auth/security");
  const noticeMessage = readQueryValue(searchParams?.notice);
  const errorMessage = readQueryValue(searchParams?.error);

  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Settings"
          title="Account and platform controls"
          description="Authentication now includes email verification, reset flows, persistent session records, and a user-level security audit trail."
        />
      </section>

      {noticeMessage ? (
        <section className="rounded-[28px] border border-teal/20 bg-teal/10 px-6 py-4 text-sm text-teal">
          {noticeMessage}
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
          {errorMessage}
        </section>
      ) : null}

      <SecurityOverview />

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-ink">Email verification</h2>
          <p className="mt-2 text-sm text-slate-600">
            Generate a fresh verification link if you still need to confirm ownership of the inbox.
          </p>
          <form action={resendVerificationAction} className="mt-5">
            <input type="hidden" name="next" value="/settings" />
            <button type="submit" className="auth-button">
              Send verification link
            </button>
          </form>
        </div>

        <div className="panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-ink">Password rotation</h2>
          <p className="mt-2 text-sm text-slate-600">
            Changing your password signs out older sessions and issues a clean replacement session.
          </p>
          <form action={changePasswordAction} className="mt-5 space-y-4">
            <PasswordField
              id="currentPassword"
              name="currentPassword"
              label="Current password"
              autoComplete="current-password"
              placeholder="Enter current password"
              required
            />
            <PasswordField
              id="newPassword"
              name="newPassword"
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
              placeholder="Repeat new password"
              required
            />
            <button type="submit" className="auth-button">
              Update password
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel rounded-3xl p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Active sessions</h2>
              <p className="mt-2 text-sm text-slate-600">
                Review current access points and cut off any browser you no longer trust.
              </p>
            </div>

            <form action={revokeOtherSessionsAction}>
              <button type="submit" className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white">
                Sign out other sessions
              </button>
            </form>
          </div>

          <div className="mt-6 space-y-3">
            {security.sessions.map((session) => (
              <div key={session.id} className="rounded-[24px] border border-ink/10 bg-white/70 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-ink">
                      {session.isCurrent ? "Current session" : "Saved session"}
                    </p>
                    <p className="text-sm text-slate-600">
                      Last seen {formatDate(session.lastSeenAt)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {session.userAgent ?? "Unknown user agent"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {session.ipAddress ?? "Unknown IP"} | Expires {formatDate(session.expiresAt)}
                    </p>
                  </div>

                  {!session.isCurrent && !session.revokedAt ? (
                    <form action={revokeSessionAction}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <button
                        type="submit"
                        className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                      >
                        Revoke
                      </button>
                    </form>
                  ) : (
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      {session.revokedAt ? "Revoked" : "This device"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-ink">Security activity</h2>
          <p className="mt-2 text-sm text-slate-600">
            Recent auth events are written to the audit log so you can trace sign-ins, resets, and
            verification changes.
          </p>

          <div className="mt-6 space-y-3">
            {security.auditEvents.map((event) => (
              <div key={event.id} className="rounded-[24px] border border-ink/10 bg-white/70 p-4">
                <p className="text-sm font-semibold text-ink">{event.eventType}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(event.createdAt)}</p>
                <p className="mt-2 text-xs text-slate-500">{event.userAgent ?? "Unknown client"}</p>
                <p className="text-xs text-slate-500">{event.ipAddress ?? "Unknown IP"}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
