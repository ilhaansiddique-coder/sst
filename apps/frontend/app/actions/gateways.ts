"use server";

import { createGatewayConfigSchema } from "@sst/shared";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { apiJson, ApiRequestError } from "../../lib/api";
import { AUTH_SESSION_COOKIE } from "../../lib/auth-constants";

type GatewayProvider = "meta" | "ga4";

type GatewayActionInput = {
  id?: string;
  provider: GatewayProvider;
  credentials: Record<string, unknown>;
  settings?: Record<string, unknown>;
  enabled?: boolean;
  containerId?: string;
  preserveVerification?: boolean;
};

type GatewayRecord = {
  id: string;
  provider: "meta" | "ga4" | "tiktok" | "snap" | "google_ads";
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
  enabled: boolean;
};

type GatewayActionResult =
  | { ok: true; item: GatewayRecord }
  | { ok: false; error: string };

type GatewayTestActionResult =
  | { ok: true; item: GatewayRecord; message: string }
  | { ok: false; item?: GatewayRecord; error: string };

export async function createGatewayAction(input: GatewayActionInput): Promise<GatewayActionResult> {
  const prepared = await prepareGatewayRequest(input);
  if ("error" in prepared) {
    return prepared;
  }

  try {
    const item = await apiJson<GatewayRecord>("/gateways", {
      method: "POST",
      token: prepared.token,
      body: JSON.stringify(prepared.payload),
    });

    revalidatePath("/gateways");

    return {
      ok: true,
      item,
    };
  } catch (error) {
    return {
      ok: false,
      error: getActionErrorMessage(error),
    };
  }
}

export async function updateGatewayAction(input: GatewayActionInput): Promise<GatewayActionResult> {
  if (!input.id) {
    return {
      ok: false,
      error: "Gateway ID is required before updating a saved destination.",
    };
  }

  const prepared = await prepareGatewayRequest(input);
  if ("error" in prepared) {
    return prepared;
  }

  try {
    const item = await apiJson<GatewayRecord>("/gateways", {
      method: "PATCH",
      token: prepared.token,
      body: JSON.stringify({
        id: input.id,
        ...prepared.payload,
      }),
    });

    revalidatePath("/gateways");

    return {
      ok: true,
      item,
    };
  } catch (error) {
    return {
      ok: false,
      error: getActionErrorMessage(error),
    };
  }
}

export async function testGatewayConnectionAction(id: string): Promise<GatewayTestActionResult> {
  const token = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;

  if (!token) {
    return {
      ok: false,
      error: "Your session expired. Please sign in again before testing this gateway.",
    };
  }

  try {
    const result = await apiJson<{
      ok: boolean;
      item: GatewayRecord;
      message: string;
    }>("/gateways/test", {
      method: "POST",
      token,
      body: JSON.stringify({ id }),
    });

    revalidatePath("/gateways");

    if (!result.ok) {
      return {
        ok: false,
        item: result.item,
        error: result.message,
      };
    }

    return {
      ok: true,
      item: result.item,
      message: result.message,
    };
  } catch (error) {
    return {
      ok: false,
      error: getActionErrorMessage(error),
    };
  }
}

function validateGatewayInput(input: GatewayActionInput): string | null {
  if (input.provider === "meta") {
    const pixelId = normalizeString(input.credentials.pixelId);
    const accessToken = normalizeString(input.credentials.accessToken);

    if (!pixelId) {
      return "Meta Pixel ID is required.";
    }

    if (!/^\d{8,20}$/.test(pixelId)) {
      return "Meta Pixel ID should be numeric only.";
    }

    if (!accessToken) {
      return "Meta access token is required.";
    }

    if (accessToken.length < 16) {
      return "Meta access token looks too short to be valid.";
    }
  }

  if (input.provider === "ga4") {
    const measurementId = normalizeString(input.credentials.measurementId);
    const apiSecret = normalizeString(input.credentials.apiSecret);

    if (!measurementId) {
      return "GA4 measurement ID is required.";
    }

    if (!/^G-[A-Z0-9]{4,}$/i.test(measurementId)) {
      return "GA4 measurement ID should look like G-XXXXXXXXXX.";
    }

    if (!apiSecret) {
      return "GA4 API secret is required.";
    }

    if (apiSecret.length < 8) {
      return "GA4 API secret looks too short to be valid.";
    }
  }

  return null;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getActionErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "We couldn't save this gateway right now.";
}

async function prepareGatewayRequest(
  input: GatewayActionInput,
):
  Promise<
    | { token: string; payload: Record<string, unknown> }
    | { ok: false; error: string }
  > {
  const token = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;

  if (!token) {
    return {
      ok: false,
      error: "Your session expired. Please sign in again before updating this gateway.",
    };
  }

  const providerValidationError = validateGatewayInput(input);
  if (providerValidationError) {
    return {
      ok: false,
      error: providerValidationError,
    };
  }

  const parsed = createGatewayConfigSchema.safeParse({
    provider: input.provider,
    credentials: input.credentials,
    settings: sanitizeGatewaySettings(input.settings ?? {}, input.preserveVerification ?? false),
    enabled: input.enabled ?? true,
    containerId: input.containerId,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please review the gateway configuration and try again.",
    };
  }

  return {
    token,
    payload: parsed.data,
  };
}

function sanitizeGatewaySettings(
  value: Record<string, unknown>,
  preserveVerification: boolean,
): Record<string, unknown> {
  if (preserveVerification) {
    return value;
  }

  const { verification, ...rest } = value;
  void verification;
  return rest;
}
