"use client";

import React from "react";
import { Users, Shield } from "lucide-react";

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
  return (
    <div
      className={`rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-md overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 bg-neutral-950/50">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-400" />
          <h3 className="font-serif text-sm font-bold text-amber-100">
            Party In Chamber
          </h3>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 text-[11px] font-mono text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{members.length}</span>
        </span>
      </div>

      {/* Member List */}
      <div className="p-3 space-y-1.5 max-h-[220px] overflow-y-auto">
        {members.length === 0 ? (
          <p className="text-xs text-neutral-500 py-2 text-center">
            No party members detected.
          </p>
        ) : (
          members.map((member) => {
            const isMe = currentUserId && String(member.id) === String(currentUserId);

            return (
              <div
                key={member.id}
                className={`flex items-center justify-between rounded-xl px-2.5 py-2 transition-colors ${
                  isMe
                    ? "bg-amber-950/30 border border-amber-800/30"
                    : "bg-neutral-950/50 border border-neutral-800/60 hover:border-neutral-700"
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
                      <span className="text-xs font-semibold text-neutral-200 truncate">
                        {member.name}
                      </span>
                      {isMe && (
                        <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-300 border border-amber-500/30">
                          YOU
                        </span>
                      )}
                    </div>
                    {member.username && member.username !== member.name && (
                      <span className="text-[10px] text-neutral-500 truncate">
                        @{member.username}
                      </span>
                    )}
                  </div>
                </div>

                <Shield className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default RoomMembers;
