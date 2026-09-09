import { NextRequest, NextResponse } from "next/server";
import { getRoomByCode, extractToken, verifyRoomAccess } from "@/lib/rooms";
import { getUserFromToken } from "@/lib/auth";

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

  const trimmedCode = code.trim();
  const result = getRoomByCode(trimmedCode);
  if (!result) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { room, recentRolls } = result;

  // If the room is password-protected, check if user is creator or has valid room access cookie/header
  if (room.hasPassword) {
    const token = extractToken(req);
    const currentUser = token ? getUserFromToken(token) : null;
    const isCreator = Boolean(currentUser && currentUser.id === room.created_by);

    let hasAccess = isCreator;

    if (!hasAccess) {
      // Check headers
      const getHeader = (name: string) =>
        typeof req.headers.get === "function" ? req.headers.get(name) : null;

      const accessHeader =
        getHeader("x-room-access") ||
        getHeader("x-room-auth") ||
        getHeader("room-access");

      if (accessHeader && accessHeader !== "false" && accessHeader !== "0") {
        hasAccess = true;
      }

      const passwordHeader =
        getHeader("x-room-password") || getHeader("room-password");
      if (!hasAccess && passwordHeader) {
        const verifyRes = await verifyRoomAccess(trimmedCode, passwordHeader);
        if (verifyRes.valid) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      // Check cookies
      const cookieHeader =
        typeof req.headers.get === "function" ? req.headers.get("cookie") : null;
      if (cookieHeader) {
        const cookieRegex = new RegExp(
          `(?:^|;\\s*)(?:room_access(?:_${room.code})?|room_auth(?:_${room.code})?)=([^;]*)`,
          "i"
        );
        const match = cookieHeader.match(cookieRegex);
        if (match && match[1] && match[1] !== "false" && match[1] !== "0") {
          hasAccess = true;
        }
      }

      if (
        !hasAccess &&
        "cookies" in req &&
        req.cookies &&
        typeof req.cookies.get === "function"
      ) {
        const c1 = req.cookies.get(`room_access_${room.code}`);
        const c2 = req.cookies.get(`room_auth_${room.code}`);
        const c3 = req.cookies.get("room_access");
        const val =
          (typeof c1 === "object" ? c1?.value : c1) ||
          (typeof c2 === "object" ? c2?.value : c2) ||
          (typeof c3 === "object" ? c3?.value : c3);
        if (val && val !== "false" && val !== "0") {
          hasAccess = true;
        }
      }
    }

    // If unverified, return recentRolls: [] to protect private room history
    if (!hasAccess) {
      return NextResponse.json(
        { room, recentRolls: [] },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({ room, recentRolls }, { status: 200 });
}
