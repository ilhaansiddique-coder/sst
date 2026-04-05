"use client";

import { useState } from "react";

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

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getSessionCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("sst_session="))
    ?.split("=")[1];
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getSessionCookie();
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function StoreExplorer({ initialEntries }: { initialEntries: KvEntry[] }) {
  const [entries, setEntries] = useState<KvEntry[]>(initialEntries);
  const [collection, setCollection] = useState("default");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newTtl, setNewTtl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<KvEntry[]>(`/store/${encodeURIComponent(collection)}`);
      setEntries(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newKey.trim()) return;
    setLoading(true);
    setError(null);
    try {
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(newValue);
      } catch {
        parsedValue = newValue;
      }

      await apiFetch(`/store/${encodeURIComponent(collection)}/${encodeURIComponent(newKey.trim())}`, {
        method: "PUT",
        body: JSON.stringify({
          value: parsedValue,
          tags: [],
          ...(newTtl ? { ttlSeconds: Number(newTtl) } : {}),
        }),
      });
      setNewKey("");
      setNewValue("");
      setNewTtl("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(key: string) {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/store/${encodeURIComponent(collection)}/${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Collection selector + refresh */}
      <section className="panel rounded-3xl p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-2">
              Collection
            </label>
            <input
              type="text"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              className="auth-input w-full"
              placeholder="default"
            />
          </div>
          <button onClick={refresh} disabled={loading} className="auth-button">
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      {/* Create new entry */}
      <section className="panel rounded-3xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-4">
          Add entry
        </p>
        <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-[1fr_2fr_auto_auto]">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="auth-input"
            placeholder="Key"
            required
          />
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="auth-input"
            placeholder='Value (string or JSON)'
          />
          <input
            type="number"
            value={newTtl}
            onChange={(e) => setNewTtl(e.target.value)}
            className="auth-input w-28"
            placeholder="TTL (sec)"
            min={1}
          />
          <button type="submit" disabled={loading} className="auth-button">
            Save
          </button>
        </form>
      </section>

      {/* Entries list */}
      {entries.length === 0 ? (
        <section className="panel rounded-3xl p-6">
          <p className="text-sm text-slate-600">
            No entries in collection &quot;{collection}&quot;. Add one above.
          </p>
        </section>
      ) : (
        <section className="grid gap-3">
          {entries.map((entry) => (
            <article key={entry.id} className="panel rounded-3xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-ink">
                      {entry.key}
                    </span>
                    {entry.tags.length > 0 && (
                      <span className="text-xs text-slate-400">
                        tags: {entry.tags.join(", ")}
                      </span>
                    )}
                  </div>
                  <pre className="mt-2 max-h-24 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                    {typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value, null, 2)}
                  </pre>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>Updated: {new Date(entry.updatedAt).toLocaleString()}</span>
                    {entry.expiresAt && (
                      <span>Expires: {new Date(entry.expiresAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(entry.key)}
                  disabled={loading}
                  className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
