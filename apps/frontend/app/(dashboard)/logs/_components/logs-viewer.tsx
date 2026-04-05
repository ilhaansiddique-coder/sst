"use client";

import { useState } from "react";

type EventLogRecord = {
  event_id: string;
  event_name: string;
  client_id: string;
  session_id: string;
  event_time: string;
  ip: string;
  country: string;
  city: string;
  device_type: string;
  os: string;
  browser: string;
  page_url: string;
  referrer: string;
  revenue: number;
  currency: string;
  destinations: string[];
  status: string;
  server_time: string;
};

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-700",
  processed: "bg-emerald-100 text-emerald-700",
  delivered: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  retrying: "bg-amber-100 text-amber-700",
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getSessionCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("sst_session="))
    ?.split("=")[1];
}

export function LogsViewer({ initialItems }: { initialItems: EventLogRecord[] }) {
  const [items, setItems] = useState<EventLogRecord[]>(initialItems);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const token = getSessionCookie();
      const res = await fetch(`${apiBase}/events?limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  // Auto-refresh every 5 seconds when enabled
  useState(() => {
    if (!autoRefresh) return;
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  });

  const filteredItems = items.filter((item) => {
    const matchesText =
      !filter ||
      item.event_name.toLowerCase().includes(filter.toLowerCase()) ||
      item.client_id.toLowerCase().includes(filter.toLowerCase()) ||
      item.event_id.toLowerCase().includes(filter.toLowerCase()) ||
      item.page_url?.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesText && matchesStatus;
  });

  return (
    <>
      {/* Filters bar */}
      <section className="panel rounded-3xl p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-2">
              Search
            </label>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="auth-input w-full"
              placeholder="Event name, client ID, URL..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="auth-input"
            >
              <option value="all">All</option>
              <option value="received">Received</option>
              <option value="processed">Processed</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={refresh} disabled={loading} className="auth-button">
              {loading ? "..." : "Refresh"}
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                autoRefresh
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {autoRefresh ? "Live" : "Auto"}
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {filteredItems.length} of {items.length} events
        </p>
      </section>

      {/* Events list */}
      {filteredItems.length === 0 ? (
        <section className="panel rounded-3xl p-6">
          <p className="text-sm text-slate-600">
            No events match your filters. Send a POST to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">/events/ingest</code> on the event processor.
          </p>
        </section>
      ) : (
        <section className="grid gap-3">
          {filteredItems.map((item) => {
            const isExpanded = expandedId === item.event_id;
            return (
              <article
                key={item.event_id}
                className="panel rounded-3xl overflow-hidden transition-all"
              >
                {/* Summary row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.event_id)}
                  className="w-full text-left p-5 hover:bg-slate-50/50 transition"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        STATUS_COLORS[item.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="font-semibold text-ink">{item.event_name}</span>
                    <span className="text-xs text-slate-400 font-mono">{item.event_id.slice(0, 8)}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      {new Date(item.event_time).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>Client: {item.client_id.slice(0, 20)}</span>
                    {item.destinations.length > 0 && (
                      <span>
                        Dest: {item.destinations.join(", ")}
                      </span>
                    )}
                    {item.revenue > 0 && (
                      <span>
                        Revenue: {item.currency} {item.revenue.toFixed(2)}
                      </span>
                    )}
                    {item.country && <span>{item.country}</span>}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-5 bg-slate-50/40">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <DetailBlock label="Event ID" value={item.event_id} />
                      <DetailBlock label="Client ID" value={item.client_id} />
                      <DetailBlock label="Session ID" value={item.session_id || "—"} />
                      <DetailBlock label="IP Address" value={item.ip} />
                      <DetailBlock label="Location" value={[item.city, item.country].filter(Boolean).join(", ") || "—"} />
                      <DetailBlock label="Device" value={`${item.device_type} / ${item.os} / ${item.browser}`} />
                      <DetailBlock label="Page URL" value={item.page_url || "—"} />
                      <DetailBlock label="Referrer" value={item.referrer || "—"} />
                      <DetailBlock label="Destinations" value={item.destinations.join(", ") || "none"} />
                      <DetailBlock label="Server Time" value={item.server_time ? new Date(item.server_time).toLocaleString() : "—"} />
                      <DetailBlock label="Revenue" value={item.revenue > 0 ? `${item.currency} ${item.revenue.toFixed(2)}` : "—"} />

                      {/* Pipeline stages */}
                      <div className="sm:col-span-2 lg:col-span-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-3">
                          Pipeline stages
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {["received", "validated", "deduplicated", "enriched", "pii_hashed", "routed", "logged"].map(
                            (stage, i) => {
                              const completed = i <= getStageIndex(item.status);
                              return (
                                <span
                                  key={stage}
                                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                    completed
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-100 text-slate-400"
                                  }`}
                                >
                                  {stage.replace("_", " ")}
                                </span>
                              );
                            },
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-700 break-all">{value}</p>
    </div>
  );
}

function getStageIndex(status: string): number {
  switch (status) {
    case "received":
      return 0;
    case "processed":
      return 5;
    case "delivered":
      return 6;
    case "failed":
      return 4;
    default:
      return 0;
  }
}
