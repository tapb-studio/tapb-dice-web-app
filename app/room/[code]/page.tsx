"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  Dices,
  Copy,
  Check,
  LogOut,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  Share2,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { DiceCanvas, DiceCanvasRollTrigger } from "@/components/DiceCanvas";
import { DiceControls, DiceType } from "@/components/DiceControls";
import { RollHistory, RollHistoryItem } from "@/components/RollHistory";
import { RoomMembers, RoomMemberItem } from "@/components/RoomMembers";

interface UserInfo {
  id: string;
  name: string;
  username: string;
}

interface RoomInfo {
  id: string;
  name: string;
  code: string;
  hasPassword: boolean;
  created_by: string;
  created_at: string;
}

export default function RoomPage() {
  const router = useRouter();
  const routeParams = useParams();
  const codeParam = (
    typeof routeParams?.code === "string"
      ? routeParams.code
      : Array.isArray(routeParams?.code)
      ? routeParams.code[0]
      : ""
  ).toUpperCase();

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password Verification Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Real-time State
  const [members, setMembers] = useState<RoomMemberItem[]>([]);
  const [rollHistory, setRollHistory] = useState<RollHistoryItem[]>([]);
  const [rollTrigger, setRollTrigger] = useState<DiceCanvasRollTrigger | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // 1. Authenticate user & load room details
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        // Auth check
        const authRes = await fetch("/api/auth/me");
        if (!authRes.ok) {
          router.replace("/");
          return;
        }
        const authData = await authRes.json();
        if (!authData?.user) {
          router.replace("/");
          return;
        }
        if (!isMounted) return;
        setCurrentUser(authData.user);

        // Fetch room info
        if (!codeParam) {
          setError("Invalid room code.");
          setIsLoading(false);
          return;
        }

        const roomRes = await fetch(`/api/rooms/${codeParam}`);
        if (!roomRes.ok) {
          const errData = await roomRes.json();
          if (isMounted) {
            setError(errData?.error || "Room not found.");
            setIsLoading(false);
          }
          return;
        }

        const roomData = await roomRes.json();
        if (!roomData?.room) {
          if (isMounted) {
            setError("Room data not found.");
            setIsLoading(false);
          }
          return;
        }

        const loadedRoom: RoomInfo = roomData.room;
        const recent: any[] = roomData.recentRolls || [];

        // Normalize initial rolls
        const normalizedHistory: RollHistoryItem[] = recent.map((r) => ({
          id: r.id,
          userName: r.user_name || "Adventurer",
          diceType: r.dice_type || "d20",
          count: r.dice_count ?? 1,
          modifier: r.modifier ?? 0,
          notation: r.notation || `${r.dice_count || 1}${r.dice_type || "d20"}`,
          individualResults: Array.isArray(r.individual_results)
            ? r.individual_results
            : [],
          total: r.total,
          isCritHit: Boolean(r.is_crit_hit),
          isCritFail: Boolean(r.is_crit_fail),
          createdAt: r.created_at || new Date().toISOString(),
        }));

        if (!isMounted) return;
        setRoom(loadedRoom);
        setRollHistory(normalizedHistory);

        // If room is password-protected, verify if user has access or prompt
        if (loadedRoom.hasPassword) {
          setShowPasswordModal(true);
        } else {
          setIsVerified(true);
        }

        setIsLoading(false);
      } catch {
        if (isMounted) {
          setError("Failed to connect to room.");
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [codeParam, router]);

  // 2. Handle Password Verification
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;

    setIsVerifyingPassword(true);
    setPasswordError(null);

    try {
      const res = await fetch("/api/rooms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: room.code,
          password: passwordInput.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        setPasswordError(data?.error || "Incorrect chamber password.");
        setIsVerifyingPassword(false);
        return;
      }

      setShowPasswordModal(false);
      setIsVerified(true);
    } catch {
      setPasswordError("Failed to verify password. Please try again.");
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  // 3. Setup Socket.io connection when verified
  useEffect(() => {
    if (!isVerified || !room || !currentUser) return;

    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

    const socket = io(origin, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    // Join room
    socket.emit("join_room", {
      roomId: room.id,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
      },
    });

    // Listeners
    socket.on("room_users_updated", (data: { users?: RoomMemberItem[] }) => {
      if (Array.isArray(data?.users)) {
        setMembers(data.users);
      }
    });

    socket.on("dice_rolled", (data: any) => {
      const socketRoll: RollHistoryItem = {
        id: data.id,
        userName: data.user?.name || "Adventurer",
        diceType: data.diceType,
        count: data.count,
        modifier: data.modifier,
        notation: data.notation,
        individualResults: data.individualResults || [],
        total: data.total,
        isCritHit: Boolean(data.isCritHit),
        isCritFail: Boolean(data.isCritFail),
        createdAt: data.createdAt || new Date().toISOString(),
      };

      // Add to roll chronicle
      setRollHistory((prev) => [socketRoll, ...prev]);

      // Trigger 3D Dice Canvas roll
      setRollTrigger({
        id: data.id,
        diceType: data.diceType,
        count: data.count,
        individualResults: data.individualResults,
        notation: data.notation,
        isCritHit: data.isCritHit,
        isCritFail: data.isCritFail,
      });

      setIsRolling(true);
    });

    return () => {
      socket.emit("leave_room", { roomId: room.id });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isVerified, room, currentUser]);

  // 4. Handle Roll Emit
  const handleRoll = useCallback(
    (diceType: DiceType, count: number, modifier: number) => {
      if (!socketRef.current || !room || isRolling) return;

      setIsRolling(true);

      socketRef.current.emit(
        "roll_dice",
        {
          roomId: room.id,
          diceType,
          count,
          modifier,
        },
        (response: { success?: boolean; error?: string }) => {
          if (response && !response.success) {
            setIsRolling(false);
          }
        }
      );
    },
    [room, isRolling]
  );

  const handleRollComplete = useCallback(() => {
    setIsRolling(false);
  }, []);

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleLeaveRoom = () => {
    router.push("/lobby");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <Dices className="h-10 w-10 text-amber-500 animate-spin" />
        <p className="text-sm font-medium text-amber-200/70 mt-3 font-mono">
          Connecting to chamber...
        </p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
        <Navbar user={currentUser} />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-2xl border border-red-900/40 bg-neutral-900/80 p-8 backdrop-blur-md shadow-2xl">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="font-serif text-2xl font-bold text-neutral-100 mb-2">
              Chamber Inaccessible
            </h2>
            <p className="text-sm text-neutral-400 mb-6">{error || "Room not found."}</p>
            <button
              type="button"
              onClick={handleLeaveRoom}
              className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-amber-500 transition-colors shadow-lg shadow-amber-600/20"
            >
              Return to Tavern Lobby
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <Navbar user={currentUser} showLobbyLink={true} />

      {/* Main Room Layout */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8 flex flex-col gap-4">
        {/* Room Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 sm:px-6 sm:py-3.5 backdrop-blur-md shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-neutral-950 font-bold shadow-md shadow-amber-600/20">
              <Dices className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-base sm:text-lg font-bold text-amber-100 truncate">
                  {room.name}
                </h1>
                {room.hasPassword && (
                  <span title="Password Protected" className="text-amber-400">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
                <span>Code:</span>
                <span className="font-bold text-amber-400">{room.code}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleCopyCode}
              title="Copy Room Code"
              className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs font-semibold text-neutral-300 hover:border-amber-500/50 hover:text-white transition-all shadow-sm"
            >
              {copiedCode ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Copy Code</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleLeaveRoom}
              title="Leave Room"
              className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs font-semibold text-neutral-400 hover:border-red-900/50 hover:bg-red-950/30 hover:text-red-400 transition-all shadow-sm"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>

        {/* Center Stage & Sidebar Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* Stage Column (3D Canvas + Controls) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {/* 3D Dice Tray Stage */}
            <div className="w-full">
              <DiceCanvas
                rollTrigger={rollTrigger}
                onRollComplete={handleRollComplete}
                className="w-full min-h-[340px] sm:min-h-[420px] lg:min-h-[460px]"
              />
            </div>

            {/* Dice Selector & Roll Controls */}
            <DiceControls
              onRoll={handleRoll}
              disabled={isRolling || !isVerified}
            />
          </div>

          {/* Right Column: Members & Chronicle */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Active Members */}
            <RoomMembers
              members={members}
              currentUserId={currentUser?.id}
            />

            {/* Real-Time Roll History */}
            <RollHistory
              rolls={rollHistory}
              className="flex-1"
            />
          </div>
        </div>
      </main>

      {/* Password Required Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl border border-amber-900/50 bg-neutral-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-serif text-base font-bold text-amber-100">
                  Protected Chamber
                </h3>
                <p className="text-xs text-neutral-400">
                  Provide password to join {room.name}
                </p>
              </div>
            </div>

            {passwordError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/40 p-2.5 text-xs text-red-200">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input
                type="password"
                autoFocus
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Chamber password"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  className="rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  Leave
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPassword}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-neutral-950 shadow-md shadow-amber-600/20 hover:bg-amber-500 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isVerifyingPassword ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Unlock Chamber</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
