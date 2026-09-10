import { NextRequest, NextResponse } from "next/server";
import {
  registerUser,
  createToken,
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

  const { name, username, password } = body || {};

  if (
    !name ||
    typeof name !== "string" ||
    !name.trim() ||
    !username ||
    typeof username !== "string" ||
    !username.trim() ||
    !password ||
    typeof password !== "string"
  ) {
    return NextResponse.json(
      { error: "Name, username, and password are required" },
      { status: 400 }
    );
  }

  try {
    const user = await registerUser(name, username, password);
    const token = createToken({
      id: user.id,
      username: user.username,
      name: user.name,
    });

    const response = NextResponse.json({ user, token }, { status: 201 });
    response.cookies.set(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
    return response;
  } catch (error: any) {
    const message = error?.message || "Registration failed";
    const status =
      message.toLowerCase().includes("already exists") ||
      message.toLowerCase().includes("taken") ||
      message.toLowerCase().includes("unique")
        ? 409
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
