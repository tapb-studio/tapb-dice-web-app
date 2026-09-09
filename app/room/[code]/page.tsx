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
  ScrollText,
  Users,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { DiceCanvas, DiceCanvasRollTrigger } from "@/components/DiceCanvas";
import { DiceControls, DiceType } from "@/components/DiceControls";
import { RollHistory, RollHistoryItem } from "@/components/RollHistory";
import { RoomMembers, RoomMemberItem } from "@/components/RoomMembers";
import { useLanguage } from "@/lib/i18n";

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
  const { t } = useLanguage();
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [mobileTab, setMobileTab] = useState<"tray" | "history" | "members">("tray");

  const socketRef = useRef<Socket | null>(null);
  const rollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

        const isSessionAuth =
          typeof window !== "undefined" &&
          window.sessionStorage.getItem("room_auth_" + codeParam) === "1";

        const roomRes = await fetch(`/api/rooms/${codeParam}`, {
          headers: isSessionAuth ? { "x-room-access": "1" } : {},
        });
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

        // Check access: public room, owner of room, or authorized in this session
        const isOwner = authData.user && loadedRoom.created_by === authData.user.id;

        if (!loadedRoom.hasPassword || isOwner || isSessionAuth) {
          setIsVerified(true);
          setShowPasswordModal(false);
        } else {
          setShowPasswordModal(true);
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

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("room_auth_" + room.code, "1");
        document.cookie = `room_access_${room.code}=1; path=/; max-age=86400; SameSite=Lax`;
      }
      setShowPasswordModal(false);
      setIsVerified(true);

      // Refresh roll history now that chamber access is verified
      try {
        const refetch = await fetch(`/api/rooms/${room.code}`, {
          headers: { "x-room-access": "1" },
        });
        if (refetch.ok) {
          const updated = await refetch.json();
          if (Array.isArray(updated.recentRolls)) {
            const normalized: RollHistoryItem[] = updated.recentRolls.map((r: any) => ({
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
            setRollHistory(normalized);
          }
        }
      } catch {
        // Non-fatal if refetch fails
      }
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

    // Join room function (used on initial connect and reconnection)
    const emitJoin = () => {
      socket.emit("join_room", {
        roomId: room.id,
        user: {
          id: currentUser.id,
          name: currentUser.name,
          username: currentUser.username,
        },
      });
    };

    socket.on("connect", emitJoin);
    if (socket.connected) {
      emitJoin();
    }

    // Listeners
    socket.on("room_users_updated", (data: { users?: RoomMemberItem[] }) => {
      if (Array.isArray(data?.users)) {
        setMembers(data.users);
      }
    });

    socket.on("dice_rolled", (data: any) => {
      if (rollTimeoutRef.current) {
        clearTimeout(rollTimeoutRef.current);
        rollTimeoutRef.current = null;
      }

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
      setMobileTab("tray");
    });

    return () => {
      if (rollTimeoutRef.current) {
        clearTimeout(rollTimeoutRef.current);
        rollTimeoutRef.current = null;
      }
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

      // Safety fallback timer so the button never stays permanently locked in isRolling state
      if (rollTimeoutRef.current) {
        clearTimeout(rollTimeoutRef.current);
      }
      const timer = setTimeout(() => setIsRolling(false), 6000);
      rollTimeoutRef.current = timer;

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
            if (rollTimeoutRef.current) {
              clearTimeout(rollTimeoutRef.current);
              rollTimeoutRef.current = null;
            }
            setIsRolling(false);
          }
        }
      );
    },
    [room, isRolling]
  );

  const handleRollComplete = useCallback(() => {
    if (rollTimeoutRef.current) {
      clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = null;
    }
    setIsRolling(false);
  }, []);

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareLink = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleLeaveRoom = () => {
    router.push("/lobby");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4 transition-colors">
        <Dices className="h-10 w-10 text-amber-500 animate-spin" />
        <p className="text-sm font-medium text-stone-600 dark:text-amber-200/70 mt-3 font-mono">
          {t("connectingToChamber")}
        </p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col transition-colors">
        <Navbar user={currentUser} />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-2xl border border-red-300 dark:border-red-900/40 bg-white/90 dark:bg-neutral-900/80 p-8 backdrop-blur-md shadow-xl">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="font-serif text-2xl font-bold text-stone-900 dark:text-neutral-100 mb-2">
              {t("chamberInaccessible")}
            </h2>
            <p className="text-sm text-stone-500 dark:text-neutral-400 mb-6">{error || t("roomNotFound")}</p>
            <button
              type="button"
              onClick={handleLeaveRoom}
              className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white dark:text-neutral-950 hover:bg-amber-500 transition-colors shadow-lg shadow-amber-600/20"
            >
              {t("returnToLobby")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)] flex flex-col transition-colors">
      <Navbar user={currentUser} showLobbyLink={true} />

      {/* Main Room Layout */}
      <main className="flex-1 min-h-0 w-full max-w-[1700px] mx-auto p-2 sm:p-3 flex flex-col gap-2 overflow-hidden">
        {/* Room Header Banner */}
        <div className="shrink-0 flex items-center justify-between gap-2 rounded-xl border border-stone-300/80 bg-white/95 dark:border-neutral-800 dark:bg-neutral-900/90 px-3 py-1.5 sm:px-4 sm:py-2 backdrop-blur-md shadow-sm transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 text-white dark:text-neutral-950 font-bold shadow-sm">
              <Dices className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-serif text-sm sm:text-base font-bold text-stone-900 dark:text-amber-100 truncate">
                  {room.name}
                </h1>
                {room.hasPassword && (
                  <span title="Password Protected" className="text-amber-600 dark:text-amber-400">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-neutral-400 font-mono">
                <span>{t("enterRoomCode")}:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">{room.code}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              title={t("copyCode")}
              className="flex items-center gap-1 rounded-lg border border-stone-300/80 bg-stone-100/90 px-2.5 py-1 text-xs font-semibold text-stone-700 hover:border-amber-400 hover:text-stone-950 dark:border-neutral-800 dark:bg-neutral-950/70 dark:text-neutral-300 dark:hover:border-amber-500/50 dark:hover:text-white transition-all shadow-sm"
            >
              {copiedCode ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">{t("codeCopied")}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="hidden sm:inline">{t("copyCode")}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShareLink}
              title={t("shareLink")}
              className="flex items-center gap-1 rounded-lg border border-stone-300/80 bg-stone-100/90 px-2.5 py-1 text-xs font-semibold text-stone-700 hover:border-amber-400 hover:text-stone-950 dark:border-neutral-800 dark:bg-neutral-950/70 dark:text-neutral-300 dark:hover:border-amber-500/50 dark:hover:text-white transition-all shadow-sm"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">{t("linkCopied")}</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="hidden sm:inline">{t("shareLink")}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleLeaveRoom}
              title={t("leaveRoom")}
              className="flex items-center gap-1 rounded-lg border border-stone-300/80 bg-stone-100/90 px-2.5 py-1 text-xs font-semibold text-stone-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-neutral-800 dark:bg-neutral-950/70 dark:text-neutral-400 dark:hover:border-red-900/50 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-all shadow-sm"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("leaveRoom")}</span>
            </button>
          </div>
        </div>

        {/* Mobile Segmented Tab Bar (< lg) */}
        <div className="flex lg:hidden items-center justify-between p-1 bg-stone-200/80 dark:bg-neutral-900/90 rounded-xl border border-stone-300/80 dark:border-neutral-800 shrink-0 gap-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setMobileTab("tray")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mobileTab === "tray"
                ? "bg-amber-600 text-white shadow-sm font-bold"
                : "text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white"
            }`}
          >
            <Dices className="h-3.5 w-3.5" />
            <span>{t("diceTrayTab")}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("history")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mobileTab === "history"
                ? "bg-amber-600 text-white shadow-sm font-bold"
                : "text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white"
            }`}
          >
            <ScrollText className="h-3.5 w-3.5" />
            <span>{t("rollHistoryTab")}</span>
            {rollHistory.length > 0 && (
              <span
                className={`ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  mobileTab === "history"
                    ? "bg-amber-800/80 text-amber-100"
                    : "bg-stone-300 dark:bg-neutral-800 text-stone-700 dark:text-amber-400"
                }`}
              >
                {rollHistory.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("members")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mobileTab === "members"
                ? "bg-amber-600 text-white shadow-sm font-bold"
                : "text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>{t("membersTab")}</span>
            <span
              className={`ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                mobileTab === "members"
                  ? "bg-amber-800/80 text-amber-100"
                  : "bg-stone-300 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {members.length}
            </span>
          </button>
        </div>

        {/* Center Stage & Sidebar Grid */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-2.5 overflow-hidden">
          {/* Stage Column (3D Canvas + Controls) */}
          <div
            className={`lg:col-span-8 flex-col min-h-0 h-full gap-2 overflow-hidden ${
              mobileTab === "tray" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* 3D Dice Tray Stage */}
            <div className="flex-1 min-h-0 w-full relative">
              <DiceCanvas
                rollTrigger={rollTrigger}
                onRollComplete={handleRollComplete}
                className="w-full h-full"
              />
            </div>

            {/* Dice Selector & Roll Controls */}
            <DiceControls
              onRoll={handleRoll}
              disabled={isRolling || !isVerified}
              className="shrink-0"
            />
          </div>

          {/* Right Column: Members & Chronicle */}
          <div
            className={`lg:col-span-4 flex-col min-h-0 h-full gap-2 overflow-hidden ${
              mobileTab !== "tray" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* Active Members */}
            <RoomMembers
              members={members}
              currentUserId={currentUser?.id}
              className={`${
                mobileTab === "members"
                  ? "flex-1 min-h-0 overflow-y-auto"
                  : "hidden lg:block shrink-0"
              }`}
            />

            {/* Real-Time Roll History */}
            <RollHistory
              rolls={rollHistory}
              className={`${
                mobileTab === "history"
                  ? "flex-1 min-h-0"
                  : "hidden lg:block lg:flex-1 lg:min-h-0"
              }`}
            />
          </div>
        </div>
      </main>

      {/* Password Required Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-amber-300 dark:border-amber-900/50 bg-white dark:bg-neutral-900 p-6 shadow-2xl transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-serif text-base font-bold text-stone-900 dark:text-amber-100">
                  {t("protectedChamber")}
                </h3>
                <p className="text-xs text-stone-500 dark:text-neutral-400">
                  {t("providePasswordToJoin")} {room.name}
                </p>
              </div>
            </div>

            {passwordError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-700 dark:text-red-200">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
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
                placeholder={t("chamberPassword")}
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder-neutral-500 transition-colors"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  className="rounded-xl border border-stone-200 bg-stone-100 px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPassword}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white dark:text-neutral-950 shadow-md shadow-amber-600/20 hover:bg-amber-500 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isVerifyingPassword ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>{t("unlockChamber")}</span>
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
