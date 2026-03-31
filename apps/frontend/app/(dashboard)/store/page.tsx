import { PageHeader } from "@/components/page-header";

export default function StorePage() {
  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Store"
          title="First-party data store"
          description="The key-value store surface is reserved for the Stape Store equivalent backed by PostgreSQL and Redis."
        />
      </section>

      <section className="panel rounded-3xl p-6">
        <p className="text-sm text-slate-600">
          Next step: connect this view to the `/store/:collection/:key` API surface and show TTL-aware records.
        </p>
      </section>
    </main>
  );
}
