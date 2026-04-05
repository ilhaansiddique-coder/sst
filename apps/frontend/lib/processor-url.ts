function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getProcessorBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_PROCESSOR_URL?.trim();
  if (explicit) {
    return trimTrailingSlash(explicit);
  }

  const apiCandidate = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.API_URL?.trim();
  if (apiCandidate) {
    try {
      const url = new URL(apiCandidate);
      if (url.pathname.endsWith("/api")) {
        url.pathname = url.pathname.slice(0, -4) || "/";
      }

      if (url.hostname === "localhost" && url.port === "3001") {
        url.port = process.env.PROCESSOR_PORT?.trim() || "3002";
      }

      return trimTrailingSlash(url.toString());
    } catch {
      // fall through to localhost default
    }
  }

  return `http://localhost:${process.env.PROCESSOR_PORT?.trim() || "3002"}`;
}

export function normalizeCustomDomain(rawValue?: string | null): string | null {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : null;
}

export function deriveContainerServerUrl(options?: {
  customDomain?: string | null;
  serverUrl?: string | null;
  processorBaseUrl?: string;
}): string {
  const explicitServerUrl = options?.serverUrl?.trim();
  if (explicitServerUrl) {
    return trimTrailingSlash(explicitServerUrl);
  }

  const customDomain = normalizeCustomDomain(options?.customDomain);
  if (customDomain) {
    return `https://${customDomain}`;
  }

  return trimTrailingSlash(options?.processorBaseUrl || getProcessorBaseUrl());
}
