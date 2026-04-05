"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Plus, X } from "lucide-react";

import {
  createGatewayAction,
  testGatewayConnectionAction,
  updateGatewayAction,
} from "../../../actions/gateways";

type Gateway = {
  id: string;
  provider: "meta" | "ga4" | "tiktok" | "snap" | "google_ads";
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
  enabled: boolean;
};

type SupportedProvider = "meta" | "ga4";
type ComposerStep = "select" | "configure";

const providers: Array<{ id: SupportedProvider; name: string; description: string }> = [
  {
    id: "meta",
    name: "Meta CAPI",
    description: "Connect your pixel and server access token for real-time conversions.",
  },
  {
    id: "ga4",
    name: "Google Analytics 4",
    description: "Send Measurement Protocol events directly into your GA4 property.",
  },
];

const initialMetaForm = {
  pixelId: "",
  accessToken: "",
  testEventCode: "",
};

const initialGa4Form = {
  measurementId: "",
  apiSecret: "",
  debugMode: true,
};

export function GatewayList({ initialItems }: { initialItems: Gateway[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [isAdding, setIsAdding] = useState(false);
  const [step, setStep] = useState<ComposerStep>("select");
  const [editingGatewayId, setEditingGatewayId] = useState<string | null>(null);
  const [newType, setNewType] = useState<SupportedProvider | null>(null);
  const [metaForm, setMetaForm] = useState(initialMetaForm);
  const [ga4Form, setGa4Form] = useState(initialGa4Form);
  const [error, setError] = useState<string | null>(null);
  const [testingGatewayId, setTestingGatewayId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openComposer() {
    setIsAdding(true);
    setStep("select");
    setEditingGatewayId(null);
    setNewType(null);
    setMetaForm(initialMetaForm);
    setGa4Form(initialGa4Form);
    setError(null);
  }

  function closeComposer() {
    setIsAdding(false);
    setStep("select");
    setEditingGatewayId(null);
    setNewType(null);
    setMetaForm(initialMetaForm);
    setGa4Form(initialGa4Form);
    setError(null);
  }

  function openEditor(gateway: Gateway) {
    const provider = toSupportedProvider(gateway.provider);
    if (!provider) {
      setError("This gateway type is not editable from the dashboard yet.");
      return;
    }

    setIsAdding(true);
    setStep("configure");
    setEditingGatewayId(gateway.id);
    setNewType(provider);
    setError(null);

    if (provider === "meta") {
      setMetaForm({
        pixelId: readString(gateway.credentials.pixelId),
        accessToken: readString(gateway.credentials.accessToken),
        testEventCode: readString(gateway.settings.testEventCode),
      });
      setGa4Form(initialGa4Form);
      return;
    }

    setGa4Form({
      measurementId: readString(gateway.credentials.measurementId),
      apiSecret: readString(gateway.credentials.apiSecret),
      debugMode: readBoolean(gateway.settings.debugMode, true),
    });
    setMetaForm(initialMetaForm);
  }

  function continueToConfigure() {
    if (!newType) {
      setError("Select a platform first so we know which setup form to show.");
      return;
    }

    setError(null);
    setStep("configure");
  }

  function handleCreateGateway() {
    if (!newType) {
      setError("Select a platform first so we know which setup form to show.");
      setStep("select");
      return;
    }

    setError(null);

    startTransition(() => {
      void submitGateway();
    });
  }

  async function submitGateway() {
    if (!newType) {
      setError("Select a platform first so we know which setup form to show.");
      setStep("select");
      return;
    }

    const result =
      newType === "meta"
        ? await (editingGatewayId ? updateGatewayAction : createGatewayAction)({
            id: editingGatewayId ?? undefined,
            provider: "meta",
            credentials: {
              pixelId: metaForm.pixelId.trim(),
              accessToken: metaForm.accessToken.trim(),
            },
            settings: {
              testEventCode: metaForm.testEventCode.trim(),
            },
            enabled: true,
          })
        : await (editingGatewayId ? updateGatewayAction : createGatewayAction)({
            id: editingGatewayId ?? undefined,
            provider: "ga4",
            credentials: {
              measurementId: ga4Form.measurementId.trim(),
              apiSecret: ga4Form.apiSecret.trim(),
            },
            settings: {
              debugMode: ga4Form.debugMode,
            },
            enabled: true,
          });

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setItems((current) =>
      editingGatewayId
        ? current.map((gateway) => (gateway.id === result.item.id ? result.item : gateway))
        : [result.item, ...current],
    );
    closeComposer();
    router.refresh();
  }

  function handleToggleEnabled(gateway: Gateway) {
    const provider = toSupportedProvider(gateway.provider);
    if (!provider) {
      setError("This gateway type is not editable from the dashboard yet.");
      return;
    }

    setError(null);

    startTransition(() => {
      void toggleGatewayEnabled(gateway, provider);
    });
  }

  async function toggleGatewayEnabled(gateway: Gateway, provider: SupportedProvider) {
    const result = await updateGatewayAction({
      id: gateway.id,
      provider,
      credentials: gateway.credentials,
      settings: gateway.settings,
      enabled: !gateway.enabled,
      preserveVerification: true,
    });

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setItems((current) => current.map((item) => (item.id === result.item.id ? result.item : item)));
    router.refresh();
  }

  function handleTestConnection(gateway: Gateway) {
    setError(null);

    startTransition(() => {
      void runGatewayTest(gateway.id);
    });
  }

  async function runGatewayTest(gatewayId: string) {
    setTestingGatewayId(gatewayId);

    const result = await testGatewayConnectionAction(gatewayId);

    setTestingGatewayId(null);

    if (result.item) {
      setItems((current) => current.map((item) => (item.id === result.item?.id ? result.item ?? item : item)));
    }

    if ("error" in result) {
      setError(result.error);
      router.refresh();
      return;
    }

    setError(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {items.length === 0 && !isAdding && (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
          <p className="font-medium text-slate-500">No destinations configured yet.</p>
          <button
            type="button"
            onClick={openComposer}
            className="mt-4 flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-5 w-5" />
            Add First Destination
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((gateway) => (
          <article key={gateway.id} className="panel flex flex-col justify-between rounded-3xl p-8">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                  {gateway.provider}
                </span>
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    gateway.enabled ? "bg-teal shadow-[0_0_8px_rgba(0,184,148,0.5)]" : "bg-slate-300"
                  }`}
                />
              </div>
              <h3 className="mt-4 font-display text-2xl font-semibold text-ink">
                {gateway.provider === "meta" ? "Meta Conversions API" : "Google Analytics 4"}
              </h3>
              <div className="mt-6 space-y-3">
                {gateway.provider === "meta" ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Pixel ID</span>
                    <span className="font-mono font-medium text-ink">
                      {maskValue(gateway.credentials.pixelId)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Measurement ID</span>
                    <span className="font-mono font-medium text-ink">
                      {String(gateway.credentials.measurementId ?? "Not set")}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Status</span>
                  <span className={gateway.enabled ? "font-medium text-teal" : "font-medium text-slate-500"}>
                    {gateway.enabled ? "Enabled" : "Paused"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-slate-500">Validation</span>
                  <span className={getGatewayValidation(gateway).tone}>
                    {getGatewayValidation(gateway).label}
                  </span>
                </div>
                <p className="text-sm text-slate-500">{getGatewayValidation(gateway).help}</p>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-6">
              <button
                type="button"
                onClick={() => openEditor(gateway)}
                className="flex-1 rounded-2xl bg-slate-50 px-4 py-2.5 font-medium text-slate-700 transition-all hover:bg-slate-100"
              >
                Configure
              </button>
              <button
                type="button"
                onClick={() => handleTestConnection(gateway)}
                disabled={isPending}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-ink transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {testingGatewayId === gateway.id ? "Testing..." : "Test Connection"}
              </button>
              <button
                type="button"
                onClick={() => handleToggleEnabled(gateway)}
                disabled={isPending}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-100 text-slate-400 transition-all hover:border-slate-200 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {gateway.enabled ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
            </div>
          </article>
        ))}

        {isAdding && (
          <div className="panel animate-in fade-in slide-in-from-bottom-4 rounded-3xl border-2 border-primary/20 bg-primary/[0.02] p-8">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
                {editingGatewayId ? "Edit Gateway" : "New Gateway"}
              </span>
              <button type="button" onClick={closeComposer} className="text-slate-400 hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-8 space-y-6">
              {step === "select" ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink">Select Platform</label>
                    <div className="grid grid-cols-2 gap-3">
                      {providers.map((provider) => (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => {
                            setNewType(provider.id);
                            setError(null);
                          }}
                          className={`rounded-2xl border-2 p-4 text-left transition-all ${
                            newType === provider.id
                              ? "border-ink bg-ink text-white"
                              : "border-slate-100 bg-white hover:border-slate-200"
                          }`}
                        >
                          <span className="block font-medium">{provider.name}</span>
                          <span
                            className={`mt-2 block text-sm ${
                              newType === provider.id ? "text-white/70" : "text-slate-500"
                            }`}
                          >
                            {provider.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={closeComposer}
                      className="rounded-2xl px-6 py-2.5 font-medium text-slate-600 transition-all hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={continueToConfigure}
                      disabled={!newType}
                      className="rounded-2xl bg-ink px-6 py-2.5 font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-ink">
                      {newType === "meta" ? "Configure Meta CAPI" : "Configure Google Analytics 4"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {newType === "meta"
                        ? "Add the pixel ID and server access token you want this account to use. Saving checks format only."
                        : "Add the GA4 measurement ID and API secret for Measurement Protocol delivery. Saving checks format only."}
                    </p>
                    <p className="text-sm text-slate-500">
                      Real validity is confirmed only after a test event or vendor-side verification succeeds.
                    </p>
                  </div>

                  {newType === "meta" ? (
                    <div className="space-y-4">
                      <Field
                        label="Pixel ID"
                        placeholder="123456789012345"
                        value={metaForm.pixelId}
                        onChange={(value) => setMetaForm((current) => ({ ...current, pixelId: value }))}
                      />
                      <Field
                        label="Access Token"
                        placeholder="EAAG..."
                        value={metaForm.accessToken}
                        onChange={(value) => setMetaForm((current) => ({ ...current, accessToken: value }))}
                      />
                      <Field
                        label="Test Event Code"
                        placeholder="Optional"
                        value={metaForm.testEventCode}
                        onChange={(value) => setMetaForm((current) => ({ ...current, testEventCode: value }))}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Field
                        label="Measurement ID"
                        placeholder="G-XXXXXXXXXX"
                        value={ga4Form.measurementId}
                        onChange={(value) => setGa4Form((current) => ({ ...current, measurementId: value }))}
                      />
                      <Field
                        label="API Secret"
                        placeholder="Generated from GA4 data stream settings"
                        value={ga4Form.apiSecret}
                        onChange={(value) => setGa4Form((current) => ({ ...current, apiSecret: value }))}
                      />
                      <label className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3">
                        <div>
                          <span className="block text-sm font-medium text-ink">Enable debug mode</span>
                          <span className="block text-sm text-slate-500">
                            Keep validation feedback on while you test the connection.
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={ga4Form.debugMode}
                          onChange={(event) =>
                            setGa4Form((current) => ({ ...current, debugMode: event.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-ink focus:ring-ink"
                        />
                      </label>
                    </div>
                  )}

                  {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("select");
                        setError(null);
                      }}
                      className="rounded-2xl px-6 py-2.5 font-medium text-slate-600 transition-all hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateGateway}
                      disabled={isPending}
                      className="rounded-2xl bg-ink px-6 py-2.5 font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPending ? "Saving..." : editingGatewayId ? "Update Destination" : "Save Destination"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!isAdding && items.length > 0 && (
          <button
            type="button"
            onClick={openComposer}
            className="panel flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-slate-200 bg-transparent p-8 transition-all hover:border-slate-300 hover:bg-slate-50/50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
              <Plus className="h-6 w-6" />
            </div>
            <span className="font-medium text-slate-500">Configure another platform</span>
          </button>
        )}
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-ink">{props.label}</span>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition-all placeholder:text-slate-400 focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
      />
    </label>
  );
}

function maskValue(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "Not set";
  }

  if (value.length <= 8) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function toSupportedProvider(provider: Gateway["provider"]): SupportedProvider | null {
  if (provider === "meta" || provider === "ga4") {
    return provider;
  }

  return null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function getGatewayValidation(gateway: Gateway): {
  help: string;
  label: string;
  tone: string;
} {
  const verification = toRecord(gateway.settings.verification);
  const verificationStatus = readString(verification.status).trim();
  const verificationMessage = readString(verification.message).trim();

  if (verificationStatus === "verified") {
    return {
      label: "Verified",
      tone: "font-medium text-teal",
      help:
        verificationMessage ||
        "The last live test connection succeeded with the currently saved credentials.",
    };
  }

  if (verificationStatus === "failed") {
    return {
      label: "Test failed",
      tone: "font-medium text-rose-700",
      help:
        verificationMessage ||
        "The last live test connection did not succeed. Review the saved credentials and try again.",
    };
  }

  if (gateway.provider === "meta") {
    const pixelId = readString(gateway.credentials.pixelId).trim();
    const accessToken = readString(gateway.credentials.accessToken).trim();

    if (!/^\d{8,20}$/.test(pixelId)) {
      return {
        label: "Pixel ID format looks wrong",
        tone: "font-medium text-amber-700",
        help: "Meta Pixel IDs should be numeric only. This one is saved locally but not structurally valid yet.",
      };
    }

    if (accessToken.length < 16) {
      return {
        label: "Token looks too short",
        tone: "font-medium text-amber-700",
        help: "The access token is stored, but it does not look long enough to be a real Meta server token.",
      };
    }

    return {
      label: "Looks valid, not verified",
      tone: "font-medium text-sky-700",
      help: "The saved fields match the expected format, but real delivery is only proven after a test event succeeds.",
    };
  }

  if (gateway.provider === "ga4") {
    const measurementId = readString(gateway.credentials.measurementId).trim();
    const apiSecret = readString(gateway.credentials.apiSecret).trim();

    if (!/^G-[A-Z0-9]{4,}$/i.test(measurementId)) {
      return {
        label: "Measurement ID format looks wrong",
        tone: "font-medium text-amber-700",
        help: "GA4 Measurement IDs should look like G-XXXXXXXXXX. This one is saved locally but not structurally valid yet.",
      };
    }

    if (apiSecret.length < 8) {
      return {
        label: "API secret looks too short",
        tone: "font-medium text-amber-700",
        help: "The API secret is stored, but it does not look long enough to be a real GA4 Measurement Protocol secret.",
      };
    }

    return {
      label: "Looks valid, not verified",
      tone: "font-medium text-sky-700",
      help: "The saved fields match the expected format, but real delivery is only proven after a test event or debug validation succeeds.",
    };
  }

  return {
    label: "Unknown validation state",
    tone: "font-medium text-slate-500",
    help: "This gateway type is not fully modeled in the dashboard yet.",
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
