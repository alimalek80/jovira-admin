import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PUBLIC_SITE_ENDPOINTS } from "@/lib/api-endpoints";

function stripBearerPrefix(token: string) {
  return token.replace(/^Bearer\s+/i, "").trim();
}

type HeroBody = Record<string, unknown>;

type HeroRequestBody = HeroBody | FormData;

function buildApiV1(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
  const trimmed = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

async function refreshAccessToken(refreshToken: string) {
  const apiV1 = buildApiV1();

  const response = await fetch(`${apiV1}/auth/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh: stripBearerPrefix(refreshToken) }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        access?: string;
        access_token?: string;
        token?: string;
        refresh?: string;
        refresh_token?: string;
      }
    | null;

  const access = payload?.access ?? payload?.access_token ?? payload?.token;
  const refresh = payload?.refresh ?? payload?.refresh_token;

  if (!access) {
    return null;
  }

  return {
    access: stripBearerPrefix(access),
    refresh: refresh ? stripBearerPrefix(refresh) : undefined,
  };
}

async function sendUpstreamRequest(method: "GET" | "PUT" | "PATCH", accessToken: string, body?: HeroRequestBody) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: HeadersInit = {
    Authorization: `Bearer ${stripBearerPrefix(accessToken)}`,
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(PUBLIC_SITE_ENDPOINTS.adminHero, {
    method,
    headers,
    ...(body
      ? {
          body: isFormData ? body : JSON.stringify(body),
        }
      : {}),
    cache: "no-store",
  });

  return response;
}

async function requestUpstream(method: "GET" | "PUT" | "PATCH", body?: HeroRequestBody) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access")?.value;

  if (!accessToken) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  let upstreamResponse = await sendUpstreamRequest(method, accessToken, body);

  // If access token is stale, try refresh once and retry the same upstream request.
  let refreshedTokens: { access: string; refresh?: string } | null = null;
  if (upstreamResponse.status === 401) {
    const refreshToken = cookieStore.get("refresh")?.value;

    if (refreshToken) {
      refreshedTokens = await refreshAccessToken(refreshToken);

      if (refreshedTokens?.access) {
        upstreamResponse = await sendUpstreamRequest(method, refreshedTokens.access, body);
      }
    }
  }

  const payload = (await upstreamResponse.json().catch(() => null)) as unknown;

  if (!upstreamResponse.ok) {
    if (upstreamResponse.status === 401) {
      return NextResponse.json(
        {
          message: "Unauthorized for hero section. Please sign in again.",
          details: payload,
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        message: "Unable to process hero section request.",
        details: payload,
      },
      { status: upstreamResponse.status }
    );
  }

  const response = NextResponse.json(payload);

  if (refreshedTokens?.access) {
    response.cookies.set("access", refreshedTokens.access, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: false,
    });

    if (refreshedTokens.refresh) {
      response.cookies.set("refresh", refreshedTokens.refresh, {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        secure: false,
      });
    }
  }

  return response;
}

export async function GET() {
  try {
    return await requestUpstream("GET");
  } catch {
    return NextResponse.json({ message: "Unable to load hero section." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const body = contentType.includes("multipart/form-data")
      ? await request.formData()
      : ((await request.json().catch(() => ({}))) as HeroBody);
    return await requestUpstream("PUT", body);
  } catch {
    return NextResponse.json({ message: "Unable to update hero section." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const body = contentType.includes("multipart/form-data")
      ? await request.formData()
      : ((await request.json().catch(() => ({}))) as HeroBody);
    return await requestUpstream("PATCH", body);
  } catch {
    return NextResponse.json({ message: "Unable to patch hero section." }, { status: 500 });
  }
}
