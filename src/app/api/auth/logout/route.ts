import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set("access", "", {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: false,
    maxAge: 0,
  });

  response.cookies.set("refresh", "", {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: false,
    maxAge: 0,
  });

  return response;
}
