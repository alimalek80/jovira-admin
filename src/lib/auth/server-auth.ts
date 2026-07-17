import { ACCOUNTS_ENDPOINTS } from "@/lib/api-endpoints";
import { canAccessAdminApp } from "@/lib/auth/roles";
import type { AuthenticatedUser } from "@/lib/auth/types";

function stripBearerPrefix(token: string) {
  return token.replace(/^Bearer\s+/i, "").trim();
}

function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payloadPart] = stripBearerPrefix(token).split(".");

    if (!payloadPart) {
      return null;
    }

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    const decoded = Buffer.from(padded, "base64").toString("utf8");

    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveCurrentUserId(accessToken: string): string | number | null {
  const payload = decodeTokenPayload(accessToken);
  const rawId = payload?.user_id ?? payload?.userId ?? payload?.id ?? payload?.sub;

  if (typeof rawId === "number" && Number.isFinite(rawId)) {
    return rawId;
  }

  if (typeof rawId === "string") {
    const trimmedId = rawId.trim();

    if (!trimmedId) {
      return null;
    }

    if (/^\d+$/.test(trimmedId)) {
      const parsed = Number.parseInt(trimmedId, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return trimmedId;
  }

  return null;
}

export async function fetchCurrentUser(
  accessToken: string
): Promise<AuthenticatedUser | null> {
  const userId = resolveCurrentUserId(accessToken);

  if (userId === null) {
    console.error(
      "[fetchCurrentUser] Could not resolve userId from token:",
      JSON.stringify(decodeTokenPayload(accessToken))
    );
    return null;
  }

  const url = `${ACCOUNTS_ENDPOINTS.adminUsers}${encodeURIComponent(String(userId))}/`;
  console.log("[fetchCurrentUser] GET", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${stripBearerPrefix(accessToken)}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("[fetchCurrentUser] HTTP", response.status, "from", url);
    return null;
  }

  return (await response.json().catch(() => null)) as AuthenticatedUser | null;
}

export async function resolveAdminAppUser(
  accessToken: string
): Promise<AuthenticatedUser | null> {
  const user = await fetchCurrentUser(accessToken);

  if (!user) {
    return null;
  }

  return canAccessAdminApp(user) ? user : null;
}