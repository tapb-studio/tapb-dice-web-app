import { NextRequest, NextResponse } from "next/server";
import { getRoomByCode } from "@/lib/rooms";

export async function GET(
  req: NextRequest | Request,
  context: { params: Promise<{ code: string }> | { code: string } }
) {
  const params = await context.params;
  const code = params?.code;

  if (!code || typeof code !== "string" || !code.trim()) {
    return NextResponse.json(
      { error: "Room code is required" },
      { status: 400 }
    );
  }

  const result = getRoomByCode(code.trim());
  if (!result) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}
