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
    const payload = JSON.parse(decoded) as Record<string, unknown>;

    return payload;
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

export async function fetchCurrentUser(accessToken: string): Promise<AuthenticatedUser | null> {
  const userId = resolveCurrentUserId(accessToken);

  if (userId === null) {
    return null;
  }

  const response = await fetch(`${ACCOUNTS_ENDPOINTS.adminUsers}${encodeURIComponent(String(userId))}/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${stripBearerPrefix(accessToken)}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as AuthenticatedUser | null;

  return payload;
}

export async function resolveAdminAppUser(accessToken: string): Promise<AuthenticatedUser | null> {
  const user = await fetchCurrentUser(accessToken);

  if (!user) {
    return null;
  }

  return canAccessAdminApp(user) ? user : null;
}
