import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf8");
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

function getBaseApiUrl() {
  const envFile = readEnvFile(resolve(process.cwd(), ".env"));
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ??
    envFile.NEXT_PUBLIC_API_URL ??
    (process.env.API_URL ?? envFile.API_URL ?? "http://localhost:3001").replace(/\/$/, "") + "/api";

  return apiBase.replace(/\/$/, "");
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!response.ok) {
    const error = typeof json === "string" ? json : JSON.stringify(json);
    throw new Error(`${response.status} ${response.statusText}: ${error}`);
  }

  return json;
}

async function main() {
  const apiBaseUrl = getBaseApiUrl();
  const marker = Date.now();
  const email = `foundation-${marker}@example.com`;
  const password = "Passw0rd!123";
  const accountName = `Foundation ${marker}`;

  console.log(`API: ${apiBaseUrl}`);

  const health = await requestJson(`${apiBaseUrl}/health`, {
    headers: { accept: "application/json" },
  });
  console.log("Health: ok");

  if (health?.status !== "ok") {
    throw new Error(`Health check returned status "${health?.status ?? "unknown"}".`);
  }

  const registerResult = await requestJson(`${apiBaseUrl}/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      accountName,
      email,
      password,
    }),
  });
  console.log("Register: ok");

  const loginResult = await requestJson(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  console.log("Login: ok");

  const accessToken = loginResult?.session?.accessToken ?? registerResult?.session?.accessToken;

  if (!accessToken) {
    throw new Error("No access token returned from auth flow.");
  }

  await requestJson(`${apiBaseUrl}/containers`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
    },
  });
  console.log("Protected containers route: ok");
  console.log("Foundation verification passed.");
}

main().catch((error) => {
  console.error("Foundation verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
