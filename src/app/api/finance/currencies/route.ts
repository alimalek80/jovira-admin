import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function buildApiV1(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
  const trimmed = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

export async function GET() {
  const apiV1 = buildApiV1();

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access")?.value;

  if (!accessToken) {
    return NextResponse.json([], { status: 401 });
  }

  try {
    const adminResponse = await fetch(`${apiV1}/finance/admin/currencies/`, {
      headers: {
        Authorization: `Bearer ${accessToken.replace(/^Bearer\s+/i, "").trim()}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (adminResponse.ok) {
      const adminData: unknown = await adminResponse.json();
      return NextResponse.json(adminData);
    }
  } catch {
    // fall through to empty list
  }

  return NextResponse.json([]);
}
