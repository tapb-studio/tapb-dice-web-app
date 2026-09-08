import { NextRequest, NextResponse } from "next/server";
import { verifyRoomAccess } from "@/lib/rooms";

export async function POST(req: NextRequest | Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { valid: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { code, password } = body || {};
  if (!code || typeof code !== "string" || !code.trim()) {
    return NextResponse.json(
      { valid: false, error: "Room code is required" },
      { status: 400 }
    );
  }

  const result = await verifyRoomAccess(
    code.trim(),
    typeof password === "string" ? password : null
  );

  if (!result.valid) {
    const status = result.error === "Room not found" ? 404 : 401;
    return NextResponse.json(
      { valid: false, error: result.error },
      { status }
    );
  }

  return NextResponse.json(
    { valid: true, room: result.room },
    { status: 200 }
  );
}
