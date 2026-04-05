import { PageHeader } from "@/components/page-header";
import { fetchApi } from "@/lib/auth";
import { LogsViewer } from "./_components/logs-viewer";

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

async function getEvents() {
  try {
    return await fetchApi<{ items: EventLogRecord[]; total: number }>("/events?limit=100");
  } catch {
    return { items: [], total: 0 };
  }
}

export default async function LogsPage() {
  const { items, total } = await getEvents();

  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Logs"
          title="Event lifecycle"
          description="Full pipeline visibility: every event from ingestion through enrichment, PII hashing, and destination delivery."
        />
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
          <span>{total} events logged</span>
        </div>
      </section>

      <LogsViewer initialItems={items} />
    </main>
  );
}
