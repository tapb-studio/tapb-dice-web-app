"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Volume2, VolumeX, LogOut, User, Dices } from "lucide-react";
import { isMuted, toggleMute } from "@/lib/audio";

export interface NavbarProps {
  user?: {
    id?: string;
    name?: string;
    username?: string;
  } | null;
  showLobbyLink?: boolean;
}

export function Navbar({ user, showLobbyLink = false }: NavbarProps) {
  const router = useRouter();
  const [muted, setMutedState] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  const handleSoundToggle = () => {
    const nextState = toggleMute();
    setMutedState(nextState);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      window.location.href = "/";
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-amber-950/60 bg-neutral-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Title */}
        <Link
          href={user ? "/lobby" : "/"}
          className="group flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-800 p-2 text-neutral-950 shadow-md shadow-amber-600/20 ring-1 ring-amber-400/40 transition-transform group-hover:scale-105">
            <Dices className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-lg font-bold tracking-wide text-amber-100 sm:text-xl">
              TAPB <span className="text-amber-400">DICE</span>
            </span>
            <span className="hidden text-[10px] font-medium uppercase tracking-widest text-amber-500/70 sm:inline-block">
              Real-Time D&D Roller
            </span>
          </div>
        </Link>

        {/* Action Controls & User Info */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Sound Toggle Button */}
          <button
            type="button"
            onClick={handleSoundToggle}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            title={muted ? "Sound: Muted (click to enable)" : "Sound: Enabled (click to mute)"}
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
              muted
                ? "border-neutral-800 bg-neutral-900 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
                : "border-amber-500/40 bg-amber-950/30 text-amber-300 shadow-sm shadow-amber-500/10 hover:border-amber-500/70 hover:bg-amber-950/50"
            }`}
          >
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>

          {/* Lobby Navigation (if in a room) */}
          {showLobbyLink && (
            <Link
              href="/lobby"
              className="rounded-lg border border-neutral-800 bg-neutral-900/90 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:border-neutral-700 hover:text-white"
            >
              Lobby
            </Link>
          )}

          {/* User Profile & Logout */}
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:border-l sm:border-neutral-800">
              <div className="flex items-center gap-2 rounded-lg bg-neutral-900/60 px-2.5 py-1.5 ring-1 ring-neutral-800">
                <User className="h-3.5 w-3.5 text-amber-400" />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-neutral-200 leading-none">
                    {user.name || user.username}
                  </span>
                  {user.username && user.name && (
                    <span className="text-[10px] text-neutral-500 leading-none mt-0.5">
                      @{user.username}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                aria-label="Log out"
                title="Log out"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition-all hover:border-red-900/60 hover:bg-red-950/30 hover:text-red-400 disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
