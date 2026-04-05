"use client";

import { useAuthSession } from "@/components/auth/auth-session-provider";

export function ViewerChip() {
  const { viewer } = useAuthSession();

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-white/55">Account</p>
        <p className="mt-2 text-xl font-semibold text-white">{viewer.account.name}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-white/75">
        <span>{viewer.user.email}</span>
        <span className="rounded-full border border-white/15 px-3 py-1 uppercase tracking-[0.18em] text-[11px] text-white/70">
          {viewer.user.role}
        </span>
      </div>
    </div>
  );
}
