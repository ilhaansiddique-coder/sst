import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Settings"
          title="Account and platform controls"
          description="Billing, team management, API keys, and white-label controls can grow here without changing the route layout."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-ink">Security</h2>
          <p className="mt-2 text-sm text-slate-600">
            JWT secrets, encryption keys, and OAuth credentials are already represented in the local env setup.
          </p>
        </div>
        <div className="panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-ink">Billing</h2>
          <p className="mt-2 text-sm text-slate-600">
            Stripe wiring is not installed yet, but the schema and blueprint path are prepared for it.
          </p>
        </div>
      </section>
    </main>
  );
}
