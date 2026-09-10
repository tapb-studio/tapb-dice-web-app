import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, getUserFromTokenAsync } from "@/lib/auth";
import { createRoom, listRooms, listRoomsAsync, extractToken } from "@/lib/rooms";

export async function POST(req: NextRequest | Request) {
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = (await getUserFromTokenAsync(token)) || getUserFromToken(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, password } = body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Room name is required" },
      { status: 400 }
    );
  }

  try {
    const room = await createRoom(
      name.trim(),
      typeof password === "string" ? password : null,
      user.id
    );
    return NextResponse.json({ room }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create room" },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest | Request) {
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "true";

  if (mine) {
    const token = extractToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = (await getUserFromTokenAsync(token)) || getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rooms = (await listRoomsAsync({ userId: user.id })) || listRooms({ userId: user.id });
    return NextResponse.json({ rooms }, { status: 200 });
  }

  const rooms = (await listRoomsAsync({ limit: 50 })) || listRooms({ limit: 50 });
  return NextResponse.json({ rooms }, { status: 200 });
}
