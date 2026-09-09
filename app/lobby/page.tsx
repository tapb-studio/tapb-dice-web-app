"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  LogIn,
  Lock,
  Unlock,
  Copy,
  Check,
  RefreshCw,
  Dices,
  Shield,
  Clock,
  ArrowRight,
  AlertCircle,
  Loader2,
  Users,
  Trash2,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/lib/i18n";

interface UserInfo {
  id: string;
  name: string;
  username: string;
}

interface RoomItem {
  id: string;
  name: string;
  code: string;
  hasPassword: boolean;
  created_by: string;
  created_at: string;
}

export default function LobbyPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Create Room state
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join Room by Code state
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Public/Recent Rooms state
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Password Prompt Modal for list-join
  const [selectedRoomForPassword, setSelectedRoomForPassword] = useState<RoomItem | null>(null);
  const [modalPassword, setModalPassword] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [isModalVerifying, setIsModalVerifying] = useState(false);

  // 1. Authenticate user
  useEffect(() => {
    let isMounted = true;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          if (isMounted) router.replace("/");
          return;
        }
        const data = await res.json();
        if (data?.user && isMounted) {
          setCurrentUser(data.user);
          setIsLoadingAuth(false);
        } else if (isMounted) {
          router.replace("/");
        }
      })
      .catch(() => {
        if (isMounted) router.replace("/");
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  // 2. Fetch Rooms
  const fetchRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    try {
      const res = await fetch("/api/rooms");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.rooms)) {
          setRooms(data.rooms);
        }
      }
    } catch {
      // ignore fetch errors
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoadingAuth) {
      fetchRooms();
    }
  }, [isLoadingAuth, fetchRooms]);

  // Handle Create Room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createName.trim()) {
      setCreateError(t("fillAllFields"));
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          password: createPassword.trim() ? createPassword.trim() : null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCreateError(data?.error || "Failed to create room.");
        setIsCreating(false);
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("room_auth_" + data.room.code, "1");
      }
      router.push(`/room/${data.room.code}`);
    } catch {
      setCreateError("Network error. Could not create room.");
      setIsCreating(false);
    }
  };

  // Handle Join Room by Code
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);

    const formattedCode = joinCode.trim().toUpperCase();
    if (!formattedCode) {
      setJoinError(t("fillAllFields"));
      return;
    }

    setIsJoining(true);
    try {
      const res = await fetch("/api/rooms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formattedCode,
          password: joinPassword.trim() ? joinPassword.trim() : null,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        setJoinError(data?.error || t("incorrectPassword"));
        setIsJoining(false);
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("room_auth_" + formattedCode, "1");
      }
      router.push(`/room/${formattedCode}`);
    } catch {
      setJoinError("Network error. Could not verify room.");
      setIsJoining(false);
    }
  };

  // Handle Direct Join from List
  const handleDirectJoin = (room: RoomItem) => {
    const isOwner = currentUser && room.created_by === currentUser.id;
    if (room.hasPassword && !isOwner) {
      setSelectedRoomForPassword(room);
      setModalPassword("");
      setModalError(null);
    } else {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("room_auth_" + room.code, "1");
      }
      router.push(`/room/${room.code}`);
    }
  };

  // Verify modal password
  const handleModalVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomForPassword) return;

    setIsModalVerifying(true);
    setModalError(null);

    try {
      const res = await fetch("/api/rooms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: selectedRoomForPassword.code,
          password: modalPassword.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        setModalError(data?.error || t("incorrectPassword"));
        setIsModalVerifying(false);
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("room_auth_" + selectedRoomForPassword.code, "1");
      }
      router.push(`/room/${selectedRoomForPassword.code}`);
    } catch {
      setModalError("Network error. Could not verify password.");
      setIsModalVerifying(false);
    }
  };

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2000);
  };

  const handleDeleteRoom = async (roomToDelete: RoomItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t("confirmDeleteRoom"))) return;

    try {
      const res = await fetch(`/api/rooms/${roomToDelete.code}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchRooms();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete room");
      }
    } catch {
      alert("Failed to delete room");
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4 transition-colors">
        <Dices className="h-10 w-10 text-amber-500 animate-spin" />
        <p className="text-sm font-medium text-stone-600 dark:text-amber-200/70 mt-3 font-mono">
          {t("signingIn")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col transition-colors">
      <Navbar user={currentUser} />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Banner */}
        <div className="mb-8 rounded-2xl border border-stone-200 dark:border-amber-900/30 bg-gradient-to-r from-amber-500/10 via-white to-white dark:from-amber-950/40 dark:via-neutral-900 dark:to-neutral-900 p-6 backdrop-blur-md shadow-md dark:shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-neutral-950 font-bold shadow-lg shadow-amber-600/30">
              <Shield className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-amber-100">
                  {currentUser?.name}!
                </h1>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-mono font-medium text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  {t("activeParty")}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-neutral-400 mt-1">
                {t("lobbySubtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* Action Grid: Create Room & Join Room */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Card 1: Create New Room */}
          <div className="rounded-2xl border border-stone-200 dark:border-amber-900/30 bg-white/80 dark:bg-neutral-900/70 p-6 backdrop-blur-md shadow-md dark:shadow-lg flex flex-col justify-between transition-colors">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-serif font-bold text-stone-900 dark:text-amber-100">
                    {t("createChamber")}
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-neutral-400">
                    {t("lobbySubtitle")}
                  </p>
                </div>
              </div>

              {createError && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-800 dark:text-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <form onSubmit={handleCreateRoom} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-neutral-300 mb-1">
                    {t("chamberName")} <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder={t("chamberNamePlaceholder")}
                    className="w-full rounded-xl border border-stone-300 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-950/80 px-3.5 py-2 text-sm text-stone-900 dark:text-neutral-100 placeholder-stone-400 dark:placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-neutral-300 mb-1">
                    {t("chamberPassword")}
                  </label>
                  <input
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder={t("chamberPasswordPlaceholder")}
                    className="w-full rounded-xl border border-stone-300 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-950/80 px-3.5 py-2 text-sm text-stone-900 dark:text-neutral-100 placeholder-stone-400 dark:placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 px-4 py-2.5 text-sm font-bold text-neutral-950 shadow-md shadow-amber-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span>{t("createBtn")}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Card 2: Join by Room Code */}
          <div className="rounded-2xl border border-stone-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/70 p-6 backdrop-blur-md shadow-md dark:shadow-lg flex flex-col justify-between transition-colors">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <LogIn className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-serif font-bold text-stone-900 dark:text-amber-100">
                    {t("joinChamber")}
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-neutral-400">
                    {t("codePlaceholder")}
                  </p>
                </div>
              </div>

              {joinError && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-800 dark:text-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}

              <form onSubmit={handleJoinByCode} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-neutral-300 mb-1">
                    {t("enterRoomCode")} <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder={t("codePlaceholder")}
                    className="w-full uppercase font-mono tracking-wider rounded-xl border border-stone-300 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-950/80 px-3.5 py-2 text-sm text-stone-900 dark:text-amber-300 placeholder-stone-400 dark:placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-neutral-300 mb-1">
                    {t("enterRoomPassword")}
                  </label>
                  <input
                    type="password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder={t("chamberPasswordPlaceholder")}
                    className="w-full rounded-xl border border-stone-300 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-950/80 px-3.5 py-2 text-sm text-stone-900 dark:text-neutral-100 placeholder-stone-400 dark:placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isJoining}
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-stone-800 hover:bg-stone-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-4 py-2.5 text-sm font-bold text-white border border-stone-700 dark:border-neutral-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isJoining ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>{t("joinBtn")}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Public / Recent Rooms Section */}
        <div className="rounded-2xl border border-stone-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 p-6 backdrop-blur-md shadow-sm dark:shadow-md transition-colors">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 dark:text-amber-100">
                {t("chambersList")}
              </h2>
              <span className="rounded-md bg-stone-200 dark:bg-neutral-800 px-2 py-0.5 text-xs font-mono text-stone-600 dark:text-neutral-400">
                {rooms.length}
              </span>
            </div>

            <button
              type="button"
              onClick={fetchRooms}
              disabled={isLoadingRooms}
              title="Refresh rooms list"
              className="flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-neutral-800 bg-stone-100 dark:bg-neutral-950/60 px-2.5 py-1.5 text-xs text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-neutral-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingRooms ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {rooms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 dark:border-neutral-800 py-12 text-center">
              <Dices className="h-8 w-8 text-stone-400 dark:text-neutral-600 mx-auto mb-2" />
              <p className="text-sm text-stone-600 dark:text-neutral-400 font-medium">
                {t("noRoomsFound")}
              </p>
              <p className="text-xs text-stone-500 dark:text-neutral-600 mt-1">
                {t("beTheFirstToCreate")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => handleDirectJoin(room)}
                  className="group relative flex flex-col justify-between rounded-xl border border-stone-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/60 p-4 transition-all hover:border-amber-500/60 hover:shadow-md dark:hover:bg-neutral-950/90 cursor-pointer shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm text-stone-900 dark:text-neutral-200 line-clamp-1 group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">
                        {room.name}
                      </h3>
                      <div className="flex items-center gap-1 shrink-0">
                        {room.hasPassword ? (
                          <span
                            title="Password protected"
                            className="flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/40 px-1.5 py-0.5 text-[10px] text-amber-800 dark:text-amber-300 font-semibold"
                          >
                            <Lock className="h-3 w-3" />
                            <span>{t("lockedRoom")}</span>
                          </span>
                        ) : (
                          <span
                            title="Public chamber"
                            className="flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/40 px-1.5 py-0.5 text-[10px] text-emerald-800 dark:text-emerald-400 font-semibold"
                          >
                            <Unlock className="h-3 w-3" />
                            <span>{t("publicRoom")}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Room Code Badge */}
                    <div className="flex items-center justify-between rounded-lg bg-stone-100 dark:bg-neutral-900/80 px-2.5 py-1.5 border border-stone-200 dark:border-neutral-800/80 my-2">
                      <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                        {room.code}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleCopyCode(room.code, e)}
                          title="Copy Room Code"
                          className="p-1 text-stone-400 dark:text-neutral-400 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                        >
                          {copiedCode === room.code ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {currentUser && room.created_by === currentUser.id && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteRoom(room, e)}
                            title={t("deleteRoom")}
                            className="p-1 text-stone-400 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-stone-100 dark:border-neutral-900 text-[11px] text-stone-500 dark:text-neutral-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(room.created_at).toLocaleDateString()}</span>
                    </div>
                    <span className="font-semibold text-amber-600 dark:text-amber-500/80 group-hover:text-amber-700 dark:group-hover:text-amber-400 flex items-center gap-1">
                      {t("joinBtn")} <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Password Prompt Modal for Locked Room */}
      {selectedRoomForPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-stone-200 dark:border-amber-900/40 bg-white dark:bg-neutral-900 p-6 shadow-2xl text-stone-900 dark:text-neutral-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-base font-bold text-stone-900 dark:text-amber-100">
                  {t("enterRoomPassword")}
                </h3>
                <p className="text-xs text-stone-500 dark:text-neutral-400">
                  {selectedRoomForPassword.name} ({selectedRoomForPassword.code})
                </p>
              </div>
            </div>

            {modalError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-800 dark:text-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleModalVerify} className="space-y-4">
              <input
                type="password"
                autoFocus
                required
                value={modalPassword}
                onChange={(e) => setModalPassword(e.target.value)}
                placeholder={t("enterPasswordToJoin")}
                className="w-full rounded-xl border border-stone-300 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-950 px-3.5 py-2 text-sm text-stone-900 dark:text-neutral-100 placeholder-stone-400 dark:placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRoomForPassword(null)}
                  className="rounded-xl border border-stone-300 dark:border-neutral-800 bg-stone-100 dark:bg-neutral-950 px-3.5 py-2 text-xs font-medium text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-neutral-200 transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isModalVerifying}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950 shadow-md shadow-amber-600/20 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isModalVerifying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>{t("unlockAndEnter")}</span>
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
