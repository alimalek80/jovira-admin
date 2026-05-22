import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canAccessAdminApp } from "@/lib/auth/roles";
import { fetchCurrentUser } from "@/lib/auth/server-auth";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access")?.value;

  if (!accessToken) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const user = await fetchCurrentUser(accessToken);

  if (!user) {
    return NextResponse.json({ message: "Unable to resolve current user." }, { status: 401 });
  }

  if (!canAccessAdminApp(user)) {
    return NextResponse.json({ message: "Access denied for this admin app." }, { status: 403 });
  }

  return NextResponse.json(user);
}
