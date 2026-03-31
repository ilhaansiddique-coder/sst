import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";

const metrics = [
  {
    label: "Containers",
    value: "1 seeded",
    detail: "Starter sample data is exposed through the API scaffold.",
  },
  {
    label: "Ingestion",
    value: "202 accepted",
    detail: "The event processor includes a validated `/events/ingest` endpoint.",
  },
  {
    label: "Databases",
    value: "3 services",
    detail: "PostgreSQL, Redis, and ClickHouse are included in Compose.",
  },
];

export default function DashboardPage() {
  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Overview"
          title="Development cockpit"
          description="A clean local dashboard shell for the platform blueprint, ready for auth, analytics, provisioning, and billing work."
        />
      </section>

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
    </main>
  );
}
