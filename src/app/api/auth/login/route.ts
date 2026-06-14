import { NextResponse } from "next/server";
import { canAccessAdminApp } from "@/lib/auth/roles";
import { fetchCurrentUser } from "@/lib/auth/server-auth";

type LoginResponseShape = {
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

function getToken(payload: LoginResponseShape | null | undefined, key: "access" | "refresh") {
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

function stripBearerPrefix(token: string) {
  return token.replace(/^Bearer\s+/i, "").trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      identifier?: string;
      username?: string;
      email?: string;
      password?: string;
    };

    const identifier = (body.identifier ?? body.username ?? body.email ?? "").trim();
    const email = (body.email ?? identifier).trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    const apiBase = resolveApiV1Base(
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1"
    );

    const upstreamResponse = await fetch(`${apiBase}/auth/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    const payload = (await upstreamResponse.json().catch(() => null)) as LoginResponseShape | null;

    if (!upstreamResponse.ok) {
      const payloadWithErrors = payload as
        | (LoginResponseShape & {
            detail?: string;
            message?: string;
            non_field_errors?: string[];
            email?: string[];
            password?: string[];
          })
        | null;

      const backendMessage =
        payloadWithErrors?.detail ??
        payloadWithErrors?.message ??
        payloadWithErrors?.non_field_errors?.[0] ??
        payloadWithErrors?.email?.[0] ??
        payloadWithErrors?.password?.[0] ??
        "Invalid credentials";

      return NextResponse.json(
        {
          message: backendMessage,
          details: payload,
        },
        { status: upstreamResponse.status }
      );
    }

    const accessToken = getToken(payload, "access");
    const refreshToken = getToken(payload, "refresh");

    if (!accessToken) {
      console.error("[login] No access token in backend response:", JSON.stringify(payload));
      return NextResponse.json(
        { message: "Login succeeded but access token is missing in response." },
        { status: 502 }
      );
    }

    console.log("[login] Got access token, fetching user profile...");
    const currentUser = await fetchCurrentUser(accessToken);
    console.log("[login] fetchCurrentUser result:", JSON.stringify(currentUser));

    if (!currentUser) {
      return NextResponse.json(
        { message: "Login succeeded but user profile could not be resolved." },
        { status: 401 }
      );
    }

    console.log("[login] canAccessAdminApp:", currentUser.role, "is_staff:", currentUser.is_staff, "is_superuser:", currentUser.is_superuser);
    if (!canAccessAdminApp(currentUser)) {
      return NextResponse.json(
        { message: "Only staff and admin users can access this app." },
        { status: 403 }
      );
    }

    const response = NextResponse.json({ ok: true, user: currentUser });

    response.cookies.set("access", stripBearerPrefix(accessToken), {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: false,
    });

    if (refreshToken) {
      response.cookies.set("refresh", stripBearerPrefix(refreshToken), {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        secure: false,
      });
    }

    return response;
  } catch {
    return NextResponse.json({ message: "Unable to sign in right now." }, { status: 500 });
  }
}