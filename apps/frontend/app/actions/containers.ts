"use server";

import { createContainerSchema } from "@sst/shared";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { apiJson, ApiRequestError } from "../../lib/api";
import { AUTH_SESSION_COOKIE } from "../../lib/auth-constants";
import { deriveContainerServerUrl, normalizeCustomDomain } from "../../lib/processor-url";

type ContainerRegion = "global" | "eu" | "us" | "apac";

type ContainerActionInput = {
  name: string;
  gtmId?: string;
  customDomain?: string;
  region: ContainerRegion;
};

type ContainerRecord = {
  id: string;
  name: string;
  gtmId?: string | null;
  serverUrl?: string | null;
  customDomain?: string | null;
  region: ContainerRegion;
  status: string;
};

type ContainerActionResult =
  | { ok: true; item: ContainerRecord }
  | { ok: false; error: string };

export async function createContainerAction(input: ContainerActionInput): Promise<ContainerActionResult> {
  const token = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;

  if (!token) {
    return {
      ok: false,
      error: "Your session expired. Please sign in again before creating a container.",
    };
  }

  const payload = {
    name: input.name.trim(),
    gtmId: normalizeOptionalString(input.gtmId),
    customDomain: normalizeCustomDomain(input.customDomain) ?? undefined,
    serverUrl: deriveContainerServerUrl({
      customDomain: input.customDomain,
    }),
    region: input.region,
  };

  const parsed = createContainerSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please review the container details and try again.",
    };
  }

  try {
    const item = await apiJson<ContainerRecord>("/containers", {
      method: "POST",
      token,
      body: JSON.stringify(parsed.data),
    });

    revalidatePath("/containers");
    revalidatePath("/dashboard");

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

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function getActionErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "We couldn't create this container right now.";
}
