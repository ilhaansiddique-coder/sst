import { PageHeader } from "@/components/page-header";

export default function LogsPage() {
  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Logs"
          title="Live event stream"
          description="This route is prepared for server-sent event streaming once the log feed is connected."
        />
      </section>

      <section className="panel rounded-3xl p-6">
        <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-slate-700">
{`event_id: sample
status: ready
message: connect SSE stream from ClickHouse or processor log feed`}
        </pre>
      </section>
    </main>
  );
}
