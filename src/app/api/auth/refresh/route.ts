import { NextResponse } from "next/server";

type RefreshResponseShape = {
  access?: string;
  access_token?: string;
  token?: string;
  refresh?: string;
  refresh_token?: string;
  tokens?: {
    access?: string;
    refresh?: string;
  };
  data?: {
    access?: string;
    access_token?: string;
    token?: string;
    refresh?: string;
    refresh_token?: string;
  };
};

function getToken(payload: RefreshResponseShape | null | undefined, key: "access" | "refresh") {
  if (!payload) {
    return undefined;
  }

  if (key === "access") {
    return (
      payload.access ??
      payload.access_token ??
      payload.token ??
      payload.tokens?.access ??
      payload.data?.access ??
      payload.data?.access_token ??
      payload.data?.token
    );
  }

  return payload.refresh ?? payload.refresh_token ?? payload.tokens?.refresh ?? payload.data?.refresh ?? payload.data?.refresh_token;
}

function resolveApiV1Base(rawBaseUrl: string) {
  const trimmed = rawBaseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      refresh?: string;
      refresh_token?: string;
    };

    const refresh = (body.refresh ?? body.refresh_token ?? "").trim();

    if (!refresh) {
      return NextResponse.json({ message: "Refresh token is required." }, { status: 400 });
    }

    const apiBase = resolveApiV1Base(
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1"
    );

    const upstreamResponse = await fetch(`${apiBase}/auth/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });

    const payload = (await upstreamResponse.json().catch(() => null)) as RefreshResponseShape | null;

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          message: "Unable to refresh session.",
          details: payload,
        },
        { status: upstreamResponse.status }
      );
    }

    const accessToken = getToken(payload, "access");
    const refreshToken = getToken(payload, "refresh");

    if (!accessToken) {
      return NextResponse.json({ message: "Refresh succeeded but access token is missing." }, { status: 502 });
    }

    const response = NextResponse.json({
      access: accessToken,
      ...(refreshToken ? { refresh: refreshToken } : {}),
    });

    response.cookies.set("access", accessToken, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: false,
    });

    if (refreshToken) {
      response.cookies.set("refresh", refreshToken, {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        secure: false,
      });
    }

    return response;
  } catch {
    return NextResponse.json({ message: "Unable to refresh session." }, { status: 500 });
  }
}
