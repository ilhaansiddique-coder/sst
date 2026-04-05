import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { fetchApi } from "@/lib/auth";

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

type BillingOverview = {
  subscriptions: Array<{ plan: string; status: string }>;
  realtimeUsage: Record<string, string>;
};

async function getUsage() {
  try {
    const raw = await fetchApi<BillingOverview>("/billing");
    const plan = raw.subscriptions?.[0]?.plan ?? "hobby";
    const quotaMap: Record<string, number> = {
      hobby: 500_000,
      starter: 2_000_000,
      growth: 10_000_000,
      scale: 50_000_000,
      enterprise: 200_000_000,
    };
    return {
      plan,
      eventQuota: quotaMap[plan] ?? 500_000,
      currentUsage: {
        total: Number(raw.realtimeUsage?.total ?? 0),
        meta: Number(raw.realtimeUsage?.meta ?? 0),
        google: Number(raw.realtimeUsage?.google ?? 0),
        tiktok: Number(raw.realtimeUsage?.tiktok ?? 0),
      },
    };
  } catch {
    return { plan: "hobby", eventQuota: 500000, currentUsage: { total: 0, meta: 0, google: 0, tiktok: 0 } };
  }
}

export default async function AnalyticsPage() {
  const [{ summary, timeseries }, usage] = await Promise.all([getAnalytics(), getUsage()]);

  const successRate =
    summary.totalEvents > 0
      ? ((summary.deliveredEvents / summary.totalEvents) * 100).toFixed(1)
      : "0.0";

  const usagePercent =
    usage.eventQuota > 0
      ? Math.min((usage.currentUsage.total / usage.eventQuota) * 100, 100)
      : 0;

  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Analytics"
          title="Platform metrics"
          description="Live event metrics from ClickHouse and Redis-backed real-time counters."
        />
      </section>

      {/* Key metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="30-day events" value={summary.totalEvents.toLocaleString()} />
        <MetricCard label="Unique clients" value={summary.uniqueClients.toLocaleString()} />
        <MetricCard label="Revenue" value={`$${summary.totalRevenue.toFixed(2)}`} />
        <MetricCard label="Delivered" value={summary.deliveredEvents.toLocaleString()} />
        <MetricCard label="Failed" value={summary.failedEvents.toLocaleString()} />
        <MetricCard label="Success rate" value={`${successRate}%`} />
      </section>

      {/* Usage meter */}
      <section className="panel rounded-3xl p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Monthly usage
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-ink">{usage.currentUsage.total.toLocaleString()}</span>
            {" / "}
            {usage.eventQuota.toLocaleString()} events
          </p>
        </div>
        <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              usagePercent > 90
                ? "bg-red-500"
                : usagePercent > 70
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-6 text-xs text-slate-500">
          <span>Plan: <span className="font-medium text-ink capitalize">{usage.plan}</span></span>
          <span>Meta: {usage.currentUsage.meta.toLocaleString()}</span>
          <span>Google: {usage.currentUsage.google.toLocaleString()}</span>
          <span>TikTok: {usage.currentUsage.tiktok.toLocaleString()}</span>
        </div>
      </section>

      {/* Platform breakdown - bar chart style */}
      {(usage.currentUsage.meta > 0 || usage.currentUsage.google > 0 || usage.currentUsage.tiktok > 0) && (
        <section className="panel rounded-3xl p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 mb-4">
            Events by platform
          </p>
          <div className="space-y-3">
            {[
              { label: "Meta CAPI", value: usage.currentUsage.meta, color: "bg-blue-500" },
              { label: "Google GA4", value: usage.currentUsage.google, color: "bg-emerald-500" },
              { label: "TikTok", value: usage.currentUsage.tiktok, color: "bg-pink-500" },
            ].map((platform) => {
              const barWidth = usage.currentUsage.total > 0
                ? (platform.value / usage.currentUsage.total) * 100
                : 0;
              return (
                <div key={platform.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700">{platform.label}</span>
                    <span className="font-medium text-ink">{platform.value.toLocaleString()}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${platform.color}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 7-day timeseries */}
      <section className="panel rounded-3xl p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 mb-4">
          7-day timeseries
        </p>
        {timeseries.length === 0 ? (
          <p className="text-sm text-slate-600">No events in the last 7 days.</p>
        ) : (
          <div className="space-y-2">
            {timeseries.map((row) => {
              const maxEvents = Math.max(...timeseries.map((r) => r.totalEvents), 1);
              const barWidth = (row.totalEvents / maxEvents) * 100;
              return (
                <div key={row.bucket} className="flex items-center gap-4">
                  <span className="w-24 text-xs text-slate-500 shrink-0">{row.bucket}</span>
                  <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="w-20 text-right text-xs font-medium text-ink shrink-0">
                    {row.totalEvents.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
