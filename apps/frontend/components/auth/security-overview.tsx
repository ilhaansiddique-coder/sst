"use client";

import { useAuthSession } from "@/components/auth/auth-session-provider";

function formatDate(value: string | null): string {
  if (!value) {
    return "Not recorded yet";
  }

  return new Date(value).toLocaleString();
}

export function SecurityOverview() {
  const { viewer } = useAuthSession();
  const isEmailVerified = Boolean(viewer.user.emailVerifiedAt);

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="panel rounded-3xl p-6">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Active session</p>
        <p className="mt-4 text-2xl font-semibold text-ink">{viewer.user.email}</p>
        <p className="mt-2 text-sm text-slate-600">
          Role: <span className="font-semibold text-ink">{viewer.user.role}</span>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Session issued:{" "}
          <span className="font-semibold text-ink">{formatDate(viewer.session.issuedAt)}</span>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Session expiry:{" "}
          <span className="font-semibold text-ink">{formatDate(viewer.session.expiresAt)}</span>
        </p>
      </div>

      <div className="panel rounded-3xl p-6">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Security model</p>
        <p className="mt-4 text-lg font-semibold text-ink">Server-managed session access</p>
        <p className="mt-2 text-sm text-slate-600">
          Dashboard routes now rely on secure HTTP-only frontend cookies, Redis-backed session keys,
          persisted session records, and role-aware API checks.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Last login:{" "}
          <span className="font-semibold text-ink">{formatDate(viewer.user.lastLogin)}</span>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Email verified:{" "}
          <span className="font-semibold text-ink">
            {isEmailVerified ? "Yes" : "Pending verification"}
          </span>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Password last changed:{" "}
          <span className="font-semibold text-ink">
            {formatDate(viewer.user.passwordChangedAt ?? null)}
          </span>
        </p>
      </div>
    </section>
  );
}
