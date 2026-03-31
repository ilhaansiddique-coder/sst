import { PageHeader } from "@/components/page-header";

const gateways = ["Meta CAPI", "GA4", "TikTok Events", "Snap CAPI"];

export default function GatewaysPage() {
  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Gateways"
          title="Destination connectors"
          description="Gateway tiles are ready to become credential forms and test-event panels for each ad platform."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {gateways.map((gateway) => (
          <div key={gateway} className="panel rounded-3xl p-6">
            <h2 className="text-xl font-semibold text-ink">{gateway}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Scaffolded placeholder for provider credentials, toggles, and test delivery.
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
