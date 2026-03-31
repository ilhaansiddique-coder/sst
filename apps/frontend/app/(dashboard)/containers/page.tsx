import { PageHeader } from "@/components/page-header";

const containers = [
  {
    name: "Primary Storefront",
    domain: "data.example.com",
    region: "global",
    status: "active",
  },
];

export default function ContainersPage() {
  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Containers"
          title="sGTM container registry"
          description="This page mirrors the blueprint route structure and is ready for live container provisioning workflows."
        />
      </section>

      <section className="grid gap-4">
        {containers.map((container) => (
          <article key={container.name} className="panel rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">{container.name}</h2>
                <p className="mt-2 text-sm text-slate-600">{container.domain}</p>
              </div>
              <div className="rounded-full bg-teal/10 px-4 py-2 text-sm font-medium text-teal">
                {container.region} · {container.status}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
