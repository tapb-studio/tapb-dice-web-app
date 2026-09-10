import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, getUserFromTokenAsync, AUTH_COOKIE_NAME } from "@/lib/auth";

function extractToken(req: NextRequest | Request): string | undefined {
  if ("cookies" in req && typeof (req as NextRequest).cookies?.get === "function") {
    const cookie = (req as NextRequest).cookies.get(AUTH_COOKIE_NAME);
    if (cookie?.value) return cookie.value;
  }
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(
      new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([^;]*)`)
    );
    if (match) return decodeURIComponent(match[1]);
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

export async function GET(req: NextRequest | Request) {
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized", user: null },
      { status: 401 }
    );
  }

  const user = (await getUserFromTokenAsync(token)) || getUserFromToken(token);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", user: null },
      { status: 401 }
    );
  }

  return NextResponse.json({ user, token }, { status: 200 });
}
