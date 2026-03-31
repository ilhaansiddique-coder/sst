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
    value: "Docker Ready",
    detail: "Compose files support database-only or full-stack startup paths.",
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
        <div className="panel rounded-[32px] px-8 py-12 md:px-12">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-teal">
            Server-Side Tracking Platform
          </p>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div className="space-y-6">
              <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-ink">
                SST is ready as a local development base for your full-stack tracking product.
              </h1>
              <p className="max-w-2xl text-lg text-slate-600">
                This starter follows the blueprint with a dashboard frontend, a NestJS API,
                an event ingestion service, and the three-database architecture needed for
                server-side tracking workloads.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/dashboard"
                  className="rounded-full bg-coral px-6 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px]"
                >
                  Open Dashboard
                </Link>
                <a
                  href={`${apiBaseUrl}/health`}
                  className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-ink"
                >
                  API Health
                </a>
              </div>
            </div>
            <div className="rounded-[28px] bg-ink p-6 text-white">
              <p className="text-sm uppercase tracking-[0.28em] text-slate-300">
                Deployment Notes
              </p>
              <div className="mt-6 space-y-3 text-sm">
                {infrastructureNotes.map((note) => (
                  <div key={note} className="rounded-2xl bg-white/10 px-4 py-3">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-6 md:grid-cols-3">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
