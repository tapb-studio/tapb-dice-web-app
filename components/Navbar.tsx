"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Volume2, VolumeX, LogOut, User, Dices, Sun, Moon, Languages } from "lucide-react";
import { isMuted, toggleMute } from "@/lib/audio";
import { useTheme } from "@/lib/theme";
import { useLanguage } from "@/lib/i18n";

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
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
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
    <header className="sticky top-0 z-40 w-full border-b border-stone-200/90 bg-white/95 text-stone-900 dark:border-amber-950/60 dark:bg-neutral-950/90 dark:text-neutral-100 backdrop-blur-md transition-colors shadow-sm">
      <div className="mx-auto flex h-14 sm:h-15 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* Brand / Title */}
        <Link
          href={user ? "/lobby" : "/"}
          className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 p-1.5 text-white dark:text-neutral-950 shadow-md shadow-amber-600/20 ring-1 ring-amber-400/40 transition-transform group-hover:scale-105">
            <Dices className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-base sm:text-lg font-bold tracking-wide text-stone-900 dark:text-amber-100">
              TAPB <span className="text-amber-600 dark:text-amber-400">DICE</span>
            </span>
            <span className="hidden text-[9px] font-medium uppercase tracking-widest text-stone-500 dark:text-amber-500/70 sm:inline-block">
              {t("appSubtitle")}
            </span>
          </div>
        </Link>

        {/* Action Controls & User Info */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Language Switcher */}
          <button
            type="button"
            onClick={toggleLanguage}
            title={language === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
            aria-label="Toggle language"
            className="flex h-8.5 items-center gap-1.5 rounded-lg border border-stone-300/80 bg-stone-100/90 px-2.5 text-xs font-semibold text-stone-800 shadow-sm transition-all hover:border-amber-500 hover:bg-stone-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:text-white"
          >
            <Languages className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span>{language === "th" ? "TH" : "EN"}</span>
          </button>

          {/* Theme Toggle Button (Dark / Light) */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t("themeLight") : t("themeDark")}
            title={theme === "dark" ? t("themeLight") : t("themeDark")}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-stone-300/80 bg-stone-100/90 text-stone-700 shadow-sm transition-all hover:border-amber-500 hover:text-amber-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-amber-400"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400 transition-transform rotate-0 hover:rotate-45" />
            ) : (
              <Moon className="h-4 w-4 text-stone-700 transition-transform -rotate-12 hover:rotate-0" />
            )}
          </button>

          {/* Sound Toggle Button */}
          <button
            type="button"
            onClick={handleSoundToggle}
            aria-label={muted ? t("soundOn") : t("soundOff")}
            title={muted ? t("soundOn") : t("soundOff")}
            className={`relative flex h-8.5 w-8.5 items-center justify-center rounded-lg border transition-all ${
              muted
                ? "border-stone-300/80 bg-stone-100/90 text-stone-400 hover:border-stone-400 hover:text-stone-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500 dark:hover:border-neutral-700 dark:hover:text-neutral-300"
                : "border-amber-400/60 bg-amber-50 text-amber-800 shadow-sm shadow-amber-500/10 hover:border-amber-500 hover:bg-amber-100/80 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:border-amber-500/70 dark:hover:bg-amber-950/50"
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
              className="rounded-lg border border-stone-300/80 bg-stone-100/90 px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:border-amber-500 hover:text-stone-950 dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:text-white"
            >
              {t("lobbyTitle").split(" ")[0]}
            </Link>
          )}

          {/* User Profile & Logout */}
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3 pl-1 sm:border-l sm:border-stone-200 dark:sm:border-neutral-800">
              <div className="flex items-center gap-2 rounded-lg bg-stone-200/70 dark:bg-neutral-900/60 px-2.5 py-1.5 ring-1 ring-stone-300 dark:ring-neutral-800">
                <User className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-stone-900 dark:text-neutral-200 leading-none">
                    {user.name || user.username}
                  </span>
                  {user.username && user.name && (
                    <span className="text-[10px] text-stone-500 dark:text-neutral-500 leading-none mt-0.5">
                      @{user.username}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                aria-label={t("logout")}
                title={t("logout")}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 bg-stone-200/80 text-stone-600 transition-all hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-red-900/60 dark:hover:bg-red-950/30 dark:hover:text-red-400 disabled:opacity-50"
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
