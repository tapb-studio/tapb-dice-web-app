import { NextRequest, NextResponse } from "next/server";
import { getRoomByCode, getRoomByCodeAsync } from "@/lib/rooms";
import { getUserFromToken, getUserFromTokenAsync } from "@/lib/auth";
import { saveRollToDbAsync } from "@/lib/dice";
import { extractToken } from "@/lib/rooms";

export async function POST(
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

  const roomRes = (await getRoomByCodeAsync(code)) || getRoomByCode(code);
  if (!roomRes) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Identify user from token or payload
  const token = extractToken(req);
  const authUser = token
    ? (await getUserFromTokenAsync(token)) || getUserFromToken(token)
    : null;

  const user = authUser || body?.user;
  if (!user || !user.id || !user.name) {
    return NextResponse.json(
      { error: "User identity is required to persist roll" },
      { status: 400 }
    );
  }

  try {
    const saved = await saveRollToDbAsync(roomRes.room.id, user, body);
    return NextResponse.json({ success: true, roll: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to persist roll" },
      { status: 500 }
    );
  }
}
