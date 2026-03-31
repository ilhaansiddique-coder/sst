import { PageHeader } from "@/components/page-header";

export default function AnalyticsPage() {
  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Analytics"
          title="ClickHouse reporting canvas"
          description="A placeholder for p95 latency charts, event volumes, and destination-level performance dashboards."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="panel rounded-3xl p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">p99 latency</p>
          <p className="mt-4 text-3xl font-semibold text-ink">&lt; 200ms target</p>
        </div>
        <div className="panel rounded-3xl p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Retention</p>
          <p className="mt-4 text-3xl font-semibold text-ink">90 days default</p>
        </div>
      </section>
    </main>
  );
}
