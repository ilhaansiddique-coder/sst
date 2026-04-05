import { PageHeader } from "@/components/page-header";
import { fetchApi } from "@/lib/auth";
import { GatewayList } from "./_components/gateway-list";

async function getGateways() {
  try {
    const { items } = await fetchApi<{ items: any[]; total: number }>("/gateways");
    return items;
  } catch (error) {
    console.error("Failed to fetch gateways:", error);
    return [];
  }
}

export default async function GatewaysPage() {
  const items = await getGateways();

  return (
    <main className="space-y-6">
      <header className="panel rounded-[42px] p-10 md:p-12">
        <PageHeader
          eyebrow="Integrations"
          title="Server-side destinations"
          description="Send your server events to Meta CAPI, GA4, and other ad platforms with just few clicks. All events are enriched on the fly."
        />
      </header>

      <div className="px-1">
        <GatewayList initialItems={items} />
      </div>
    </main>
  );
}
