import { PageHeader } from "@/components/page-header";
import { fetchApi } from "@/lib/auth";
import { StoreExplorer } from "./_components/store-explorer";

type KvEntry = {
  id: string;
  accountId: string;
  collection: string;
  key: string;
  value: unknown;
  tags: string[];
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

async function getStoreEntries() {
  try {
    return await fetchApi<KvEntry[]>("/store/default");
  } catch {
    return [];
  }
}

export default async function StorePage() {
  const entries = await getStoreEntries();

  return (
    <main className="space-y-6">
      <section className="panel rounded-[36px] p-8 md:p-10">
        <PageHeader
          eyebrow="Store"
          title="First-party data store"
          description="TTL-aware key-value store backed by PostgreSQL and Redis. Store first-party customer data, consent records, and enrichment lookups."
        />
      </section>

      <StoreExplorer initialEntries={entries} />
    </main>
  );
}
