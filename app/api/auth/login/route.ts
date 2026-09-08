import { NextRequest, NextResponse } from "next/server";
import {
  loginUser,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
} from "@/lib/auth";

export async function POST(req: NextRequest | Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { username, password } = body || {};

  if (
    !username ||
    typeof username !== "string" ||
    !username.trim() ||
    !password ||
    typeof password !== "string"
  ) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 }
    );
  }

  try {
    const { user, token } = await loginUser(username, password);
    const response = NextResponse.json({ user }, { status: 200 });
    response.cookies.set(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
    return response;
  } catch (error: any) {
    const message = error?.message || "Invalid username or password";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
