"use client";

import React from "react";
import { Users, Shield } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export interface RoomMemberItem {
  id: string;
  name: string;
  username?: string;
}

export interface RoomMembersProps {
  members: RoomMemberItem[];
  currentUserId?: string;
  className?: string;
}

export function RoomMembers({
  members,
  currentUserId,
  className = "",
}: RoomMembersProps) {
  const { t } = useLanguage();

  return (
    <div
      className={`rounded-2xl border border-stone-300/80 bg-white/95 dark:border-neutral-800 dark:bg-neutral-900/90 backdrop-blur-md overflow-hidden shadow-sm transition-colors ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200/90 px-3 py-2 sm:px-3.5 sm:py-2 bg-stone-50/90 dark:border-neutral-800 dark:bg-neutral-950/50">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-serif text-xs sm:text-sm font-bold text-stone-900 dark:text-amber-100">
            {t("activeParty")}
          </h3>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-100/90 border border-emerald-300/70 dark:bg-emerald-950/60 dark:border-emerald-800/40 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono text-emerald-800 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
          <span>{members.length}</span>
        </span>
      </div>

      {/* Member List */}
      <div className="p-2 space-y-1 overflow-y-auto max-h-[130px]">
        {members.length === 0 ? (
          <p className="text-xs text-stone-400 dark:text-neutral-500 py-2 text-center">
            {t("noMembersDetected")}
          </p>
        ) : (
          members.map((member) => {
            const isMe = currentUserId && String(member.id) === String(currentUserId);

            return (
              <div
                key={member.id}
                className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-colors ${
                  isMe
                    ? "bg-amber-50/90 border border-amber-300/80 text-stone-900 dark:bg-amber-950/30 dark:border-amber-800/30"
                    : "bg-stone-50/90 border border-stone-200/90 hover:border-stone-300 text-stone-800 dark:bg-neutral-950/50 dark:border-neutral-800/60 dark:hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Status indicator dot */}
                  <div className="relative shrink-0 flex items-center justify-center">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="absolute -inset-0.5 rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  </div>

                  {/* Member Name */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-stone-800 dark:text-neutral-200 truncate">
                        {member.name}
                      </span>
                      {isMe && (
                        <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          {t("you")}
                        </span>
                      )}
                    </div>
                    {member.username && member.username !== member.name && (
                      <span className="text-[10px] text-stone-400 dark:text-neutral-500 truncate">
                        @{member.username}
                      </span>
                    )}
                  </div>
                </div>

                <Shield className="h-3.5 w-3.5 text-stone-400 dark:text-neutral-600 shrink-0" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default RoomMembers;
