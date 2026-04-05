import { PageHeader } from "@/components/page-header";
import { fetchApi } from "@/lib/auth";
import { deriveContainerServerUrl, getProcessorBaseUrl } from "@/lib/processor-url";

import { ContainerRegistry } from "./_components/container-registry";

type Container = {
  id: string;
  gtmId?: string | null;
  serverUrl?: string | null;
  name: string;
  customDomain?: string | null;
  region: "global" | "eu" | "us" | "apac";
  status: string;
};

async function getContainers() {
  try {
    return await fetchApi<{ items: Container[]; total: number }>("/containers");
  } catch {
    return { items: [], total: 0 };
  }
}

async function getProcessorStatus(processorBaseUrl: string) {
  try {
    const response = await fetch(`${processorBaseUrl}/health`, {
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}

export default async function ContainersPage() {
  const { items } = await getContainers();
  const processorBaseUrl = getProcessorBaseUrl();
  const processorHealthy = await getProcessorStatus(processorBaseUrl);
  const containers = items.map((container) => ({
    ...container,
    domain: container.customDomain || "Using shared processor URL",
    serverUrl: deriveContainerServerUrl({
      customDomain: container.customDomain,
      serverUrl: container.serverUrl,
      processorBaseUrl,
    }),
  }));
  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Containers"
          title="sGTM collector registry"
          description="Create an SST collector container, expose its event endpoints, and point client traffic into your server-side pipeline."
        />
      </section>

      <ContainerRegistry
        initialItems={containers}
        processorBaseUrl={processorBaseUrl}
        processorHealthy={processorHealthy}
      />
    </main>
  );
  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <PageHeader
          eyebrow="Containers"
          title="sGTM collector registry"
          description="Create an SST collector container, expose its event endpoints, and point client traffic into your server-side pipeline."
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
