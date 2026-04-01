import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { fetchApi } from "@/lib/api";

async function getDashboardMetrics() {
  try {
    const [containers, analytics] = await Promise.all([
      fetchApi<{ items: Array<unknown>; total: number }>("/containers"),
      fetchApi<{ totalEvents: number; uniqueClients: number }>("/analytics/summary?days=30"),
    ]);

    return [
      {
        label: "Containers",
        value: String(containers.total),
        detail: "Provisioned container records now come from PostgreSQL.",
      },
      {
        label: "30-day Events",
        value: String(analytics.totalEvents),
        detail: "Accepted events are persisted in ClickHouse for analytics and logs.",
      },
      {
        label: "Unique Clients",
        value: String(analytics.uniqueClients),
        detail: "Redis and ClickHouse together support realtime counters plus historical queries.",
      },
    ];
  } catch {
    return [
      {
        label: "Containers",
        value: "0",
        detail: "Provisioned container records now come from PostgreSQL.",
      },
      {
        label: "30-day Events",
        value: "0",
        detail: "Accepted events are persisted in ClickHouse for analytics and logs.",
      },
      {
        label: "Unique Clients",
        value: "0",
        detail: "Redis and ClickHouse together support realtime counters plus historical queries.",
      },
    ];
  }
}

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();

  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Overview"
          title="Development cockpit"
          description="The platform now persists relational data in PostgreSQL, caches and sessions in Redis, and analytics events in ClickHouse."
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
