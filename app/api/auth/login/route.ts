import { NextRequest, NextResponse } from "next/server";
import {
  loginUser,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
} from "@/lib/auth";

export async function POST(req: NextRequest | Request) {
  try {
    const body = await req.json();
    const { username, password } = body || {};

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const { user, token } = await loginUser(username, password);
    const response = NextResponse.json({ user }, { status: 200 });
    response.cookies.set(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
    return response;
  } catch (error: any) {
    const message = error?.message || "Invalid username or password";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
