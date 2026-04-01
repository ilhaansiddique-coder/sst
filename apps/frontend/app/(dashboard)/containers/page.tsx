import { PageHeader } from "@/components/page-header";

import { fetchApi } from "@/lib/api";

type Container = {
  id: string;
  name: string;
  customDomain?: string | null;
  region: string;
  status: string;
};

async function getContainers() {
  try {
    return await fetchApi<{ items: Container[]; total: number }>("/containers");
  } catch {
    return { items: [], total: 0 };
  }
}

export default async function ContainersPage() {
  const { items } = await getContainers();
  const containers = items.map((container) => ({
    name: container.name,
    domain: container.customDomain || "No custom domain configured",
    region: container.region,
    status: container.status,
  }));
  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Containers"
          title="sGTM container registry"
          description="This page now reflects the PostgreSQL-backed container inventory exposed by the API."
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
