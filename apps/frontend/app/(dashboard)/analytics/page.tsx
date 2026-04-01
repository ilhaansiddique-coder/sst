import { PageHeader } from "@/components/page-header";
import { fetchApi } from "@/lib/api";

type Summary = {
  days: number;
  totalEvents: number;
  uniqueClients: number;
  totalRevenue: number;
  deliveredEvents: number;
  failedEvents: number;
};

type TimeseriesRow = {
  bucket: string;
  totalEvents: number;
  revenue: number;
  uniqueClients: number;
};

async function getAnalytics() {
  try {
    const [summary, timeseries] = await Promise.all([
      fetchApi<Summary>("/analytics/summary?days=30"),
      fetchApi<TimeseriesRow[]>("/analytics/timeseries?days=7"),
    ]);

    return { summary, timeseries };
  } catch {
    return {
      summary: {
        days: 30,
        totalEvents: 0,
        uniqueClients: 0,
        totalRevenue: 0,
        deliveredEvents: 0,
        failedEvents: 0,
      },
      timeseries: [] as TimeseriesRow[],
    };
  }
}

export default async function AnalyticsPage() {
  const { summary, timeseries } = await getAnalytics();

  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Analytics"
          title="ClickHouse reporting canvas"
          description="Live event metrics now come from ClickHouse and Redis-backed realtime counters."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="panel rounded-3xl p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">30-day events</p>
          <p className="mt-4 text-3xl font-semibold text-ink">{summary.totalEvents}</p>
        </div>
        <div className="panel rounded-3xl p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Unique clients</p>
          <p className="mt-4 text-3xl font-semibold text-ink">{summary.uniqueClients}</p>
        </div>
        <div className="panel rounded-3xl p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Revenue</p>
          <p className="mt-4 text-3xl font-semibold text-ink">
            ${summary.totalRevenue.toFixed(2)}
          </p>
        </div>
        <div className="panel rounded-3xl p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">7-day timeseries</p>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            {timeseries.length === 0 ? (
              <p>No ClickHouse events yet.</p>
            ) : (
              timeseries.map((row) => (
                <div key={row.bucket} className="flex items-center justify-between gap-4">
                  <span>{row.bucket}</span>
                  <span>{row.totalEvents} events</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
