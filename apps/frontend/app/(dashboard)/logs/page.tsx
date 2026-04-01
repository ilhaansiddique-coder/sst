import { PageHeader } from "@/components/page-header";
import { fetchApi } from "@/lib/api";

type EventLogRecord = {
  eventId: string;
  eventName: string;
  clientId: string;
  timestamp: string;
  destinations: string[];
  status: "received" | "processed" | "failed" | "delivered";
  source: "processor";
  receivedAt: string;
};

async function getEvents() {
  try {
    return await fetchApi<{ items: EventLogRecord[]; total: number }>("/events");
  } catch {
    return { items: [], total: 0 };
  }
}

export default async function LogsPage() {
  const { items } = await getEvents();

  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Logs"
          title="Live event stream"
          description="Accepted ingestion events now appear here through the API, giving the scaffold a simple live test loop."
        />
      </section>

      {items.length === 0 ? (
        <section className="panel rounded-3xl p-6">
          <p className="text-sm text-slate-600">
            No events logged yet. Send a POST request to the processor&apos;s
            ` /events/ingest ` endpoint, then refresh this page.
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {items.map((item) => (
            <article key={item.eventId} className="panel rounded-3xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {item.status}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">{item.eventName}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Client: {item.clientId}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Destinations: {item.destinations.join(", ") || "none"}
                  </p>
                </div>
                <div className="text-right text-sm text-slate-500">
                  <p>{new Date(item.timestamp).toLocaleString()}</p>
                  <p className="mt-1">Logged via {item.source}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
