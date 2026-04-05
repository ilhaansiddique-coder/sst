"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, Server, X } from "lucide-react";

import { createContainerAction } from "../../../actions/containers";

type Container = {
  id: string;
  name: string;
  gtmId?: string | null;
  serverUrl?: string | null;
  customDomain?: string | null;
  region: "global" | "eu" | "us" | "apac";
  status: string;
};

const initialForm = {
  name: "",
  gtmId: "",
  customDomain: "",
  region: "global" as Container["region"],
};

export function ContainerRegistry({
  initialItems,
  processorBaseUrl,
  processorHealthy,
}: {
  initialItems: Container[];
  processorBaseUrl: string;
  processorHealthy: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openComposer() {
    setIsAdding(true);
    setForm(initialForm);
    setError(null);
  }

  function closeComposer() {
    setIsAdding(false);
    setForm(initialForm);
    setError(null);
  }

  function handleCreate() {
    setError(null);

    startTransition(() => {
      void submitContainer();
    });
  }

  async function submitContainer() {
    const result = await createContainerAction(form);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setItems((current) => [result.item, ...current]);
    closeComposer();
    router.refresh();
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      window.setTimeout(() => {
        setCopiedValue((current) => (current === value ? null : current));
      }, 1500);
    } catch {
      setError("Clipboard access failed. Copy the URL manually.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel rounded-3xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              sGTM-Compatible Collector
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Enable your SST tagging endpoint</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              This enables the SST collector URLs clients can use for server-side GA4 and sGTM-style event routing.
              It does not yet provision a full hosted Google server container with custom SSL and automation.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/70 px-5 py-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-2.5 w-2.5 rounded-full ${
                  processorHealthy ? "bg-teal shadow-[0_0_10px_rgba(0,184,148,0.45)]" : "bg-amber-500"
                }`}
              />
              <span className="font-medium text-ink">
                {processorHealthy ? "Collector online" : "Collector unavailable"}
              </span>
            </div>
            <p className="mt-2 break-all text-slate-500">{processorBaseUrl}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={openComposer}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Enable sGTM Endpoint
          </button>
        </div>
      </section>

      {isAdding && (
        <section className="panel rounded-3xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">New Container</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Create an SST collector container</h3>
            </div>
            <button
              type="button"
              onClick={closeComposer}
              className="rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:text-ink"
              aria-label="Close create container form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-ink">Container name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Storefront main"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-ink">Google Tag Manager ID</span>
              <input
                value={form.gtmId}
                onChange={(event) => setForm((current) => ({ ...current, gtmId: event.target.value }))}
                placeholder="GTM-XXXXXXX"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-ink">Custom domain</span>
              <input
                value={form.customDomain}
                onChange={(event) => setForm((current) => ({ ...current, customDomain: event.target.value }))}
                placeholder="sgtm.clientsite.com"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-ink">Region</span>
              <select
                value={form.region}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    region: event.target.value as Container["region"],
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-slate-400"
              >
                <option value="global">Global</option>
                <option value="us">US</option>
                <option value="eu">EU</option>
                <option value="apac">APAC</option>
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            Collector base URL: {form.customDomain.trim() ? `https://${form.customDomain.trim().replace(/^https?:\/\//i, "")}` : processorBaseUrl}
          </div>

          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeComposer}
              className="rounded-full px-5 py-3 text-sm font-medium text-slate-600 transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending}
              className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Creating..." : "Create Container"}
            </button>
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <section className="panel rounded-3xl p-8 text-center">
          <Server className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-4 text-xl font-semibold text-ink">No collector containers yet</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Create your first container to expose a usable sGTM-compatible collector URL for websites, GTM setups,
            and Measurement Protocol traffic.
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {items.map((container) => {
            const serverUrl = container.serverUrl || processorBaseUrl;
            const collectUrl = `${serverUrl}/g/collect`;
            const mpCollectUrl = `${serverUrl}/mp/collect`;
            const ingestUrl = `${serverUrl}/events/ingest`;

            return (
              <article key={container.id} className="panel rounded-3xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{container.region}</p>
                    <h3 className="mt-2 text-2xl font-semibold text-ink">{container.name}</h3>
                    <p className="mt-3 text-sm text-slate-600">
                      Base URL: <span className="font-medium text-ink">{serverUrl}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      GTM ID: <span className="font-medium text-ink">{container.gtmId || "Not linked yet"}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Domain: <span className="font-medium text-ink">{container.customDomain || "Using shared processor URL"}</span>
                    </p>
                  </div>

                  <div className="rounded-full bg-teal/10 px-4 py-2 text-sm font-medium text-teal">
                    {container.status}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  <EndpointCard
                    label="sGTM collect"
                    value={collectUrl}
                    copied={copiedValue === collectUrl}
                    onCopy={() => void handleCopy(collectUrl)}
                    help="Use this as the sGTM-compatible collect endpoint."
                  />
                  <EndpointCard
                    label="Measurement Protocol proxy"
                    value={mpCollectUrl}
                    copied={copiedValue === mpCollectUrl}
                    onCopy={() => void handleCopy(mpCollectUrl)}
                    help="Use this for server-side GA4 Measurement Protocol payloads."
                  />
                  <EndpointCard
                    label="Direct event ingest"
                    value={ingestUrl}
                    copied={copiedValue === ingestUrl}
                    onCopy={() => void handleCopy(ingestUrl)}
                    help="Use this for direct JSON events like purchase or add_to_cart."
                  />
                </div>

                <div className="mt-6 rounded-3xl border border-slate-200 bg-white/70 p-5">
                  <p className="text-sm font-medium text-ink">Setup steps</p>
                  <ol className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
                    <li>1. Point the client website or backend to one of the collector URLs above.</li>
                    <li>2. For GA4 server events, use the Measurement Protocol proxy or direct ingest route.</li>
                    <li>3. For sGTM-style collection, use the base URL in GTM server-side transport settings.</li>
                    <li>4. Send a real `purchase` event and confirm it appears in SST Logs and the client GA4 property.</li>
                  </ol>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function EndpointCard({
  label,
  value,
  help,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  help: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 break-all text-sm font-medium text-ink">{value}</p>
      <p className="mt-3 text-sm text-slate-600">{help}</p>
      <button
        type="button"
        onClick={onCopy}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-slate-300"
      >
        {copied ? <Check className="h-4 w-4 text-teal" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy URL"}
      </button>
    </div>
  );
}
