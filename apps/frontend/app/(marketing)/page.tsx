import Link from "next/link";

import { MetricCard } from "@/components/metric-card";
import { apiBaseUrl } from "@/lib/api";

const metrics = [
  {
    label: "Core Stack",
    value: "Next + Nest",
    detail: "Frontend and dashboard API scaffolded for rapid feature work.",
  },
  {
    label: "Data Layer",
    value: "PG + Redis + CH",
    detail: "PostgreSQL, Redis, and ClickHouse are wired for local development.",
  },
  {
    label: "Deployment Path",
    value: "Render Ready",
    detail: "The monorepo is configured for native Render service deploys.",
  },
];

export default function MarketingHome() {
  const infrastructureNotes = [
    "Frontend: Render web service",
    "API: configured with NEXT_PUBLIC_API_URL",
    "Processor: Render web service",
    "Storage: Postgres, Key Value, and ClickHouse-compatible analytics backend",
  ];

  return (
    <main className="px-6 py-8 md:px-10 lg:px-14">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="panel rounded-[36px] px-8 py-12 md:px-12">
            <div className="auth-pill">Server-side tracking platform</div>
            <div className="mt-8 space-y-6">
              <h1 className="max-w-4xl font-display text-5xl leading-[0.95] text-ink md:text-7xl">
                Bring your event engine, dashboard, and delivery stack into one system.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-700">
                SST gives you a strong local base: a protected dashboard frontend, a NestJS API,
                an event processor, and the storage layers needed for real tracking workloads.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/register" className="auth-button">
                  Create workspace
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-full border border-ink/10 bg-white/85 px-6 py-4 text-sm font-semibold text-ink transition hover:translate-y-[-1px]"
                >
                  Open dashboard
                </Link>
                <a
                  href={`${apiBaseUrl}/health`}
                  className="rounded-full border border-ink/10 bg-[#f8d9a2]/65 px-6 py-4 text-sm font-semibold text-ink transition hover:translate-y-[-1px]"
                >
                  API health
                </a>
              </div>
            </div>
          </section>

          <aside className="panel rounded-[36px] bg-[#163221] p-8 text-white">
            <p className="text-sm uppercase tracking-[0.28em] text-white/55">Deployment notes</p>
            <div className="mt-6 space-y-3 text-sm">
              {infrastructureNotes.map((note) => (
                <div key={note} className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-3">
                  {note}
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-[26px] border border-white/10 bg-white/8 p-5">
              <p className="text-sm uppercase tracking-[0.24em] text-white/55">Auth baseline</p>
              <p className="mt-3 font-display text-3xl leading-none text-white">Session-first</p>
              <p className="mt-3 text-sm leading-7 text-white/74">
                Login and registration now land inside the same visual system as the protected
                dashboard, with cookie-backed sessions and role-aware API access.
              </p>
            </div>
          </aside>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
            />
          ))}
        </div>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="panel rounded-[32px] p-8">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Experience note</p>
            <h2 className="mt-4 font-display text-4xl leading-[1.02] text-ink">
              The dashboard now shares the same paper, grid, and green-gold palette as auth.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel rounded-[28px] p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Access</p>
              <p className="mt-3 text-lg font-semibold text-ink">Protected dashboard routes</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                Authenticated users move straight from login into the same visual environment rather
                than jumping into a different-looking shell.
              </p>
            </div>
            <div className="rounded-[28px] border border-ink/10 bg-[#f8d9a2]/65 p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-700">Consistency</p>
              <p className="mt-3 text-lg font-semibold text-ink">One system, one color grade</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                Mint, cream, deep green, and warm gold now carry from landing pages into settings,
                analytics, and the app shell.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
