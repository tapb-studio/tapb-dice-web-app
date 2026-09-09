"use client";

import React from "react";
import { Trophy, AlertTriangle, ScrollText } from "lucide-react";

export interface RollHistoryItem {
  id: string;
  userName: string;
  diceType: string;
  count: number;
  modifier: number;
  notation: string;
  individualResults: number[];
  total: number;
  isCritHit: boolean;
  isCritFail: boolean;
  createdAt: string;
}

export interface RollHistoryProps {
  rolls: RollHistoryItem[];
  className?: string;
}

function formatRollTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export function RollHistory({ rolls, className = "" }: RollHistoryProps) {
  return (
    <div
      className={`flex flex-col h-full rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-md overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 bg-neutral-950/50">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-amber-400" />
          <h3 className="font-serif text-sm font-bold text-amber-100">
            Roll Chronicle
          </h3>
        </div>
        <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-mono text-neutral-400">
          {rolls.length} {rolls.length === 1 ? "roll" : "rolls"}
        </span>
      </div>

      {/* Rolls List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[460px]">
        {rolls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-500">
            <ScrollText className="h-8 w-8 text-neutral-600 mb-2" />
            <p className="text-xs font-medium">The chronicle is unwritten.</p>
            <p className="text-[11px] text-neutral-600 mt-0.5">
              Roll the dice to record the party's fate!
            </p>
          </div>
        ) : (
          rolls.map((roll) => {
            const isCrit = roll.isCritHit;
            const isFail = roll.isCritFail;

            return (
              <div
                key={roll.id}
                className={`relative rounded-xl border p-3 transition-all ${
                  isCrit
                    ? "border-amber-500/70 bg-gradient-to-br from-amber-950/40 via-neutral-900 to-neutral-900 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30"
                    : isFail
                    ? "border-red-600/70 bg-gradient-to-br from-red-950/40 via-neutral-900 to-neutral-900 shadow-md shadow-red-500/10 ring-1 ring-red-600/30"
                    : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-700"
                }`}
              >
                {/* Top: Roller & Time & Formula */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-xs text-neutral-200 truncate">
                      {roll.userName}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {formatRollTime(roll.createdAt)}
                    </span>
                  </div>

                  <span className="shrink-0 rounded bg-neutral-800/90 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-300">
                    {roll.notation}
                  </span>
                </div>

                {/* Critical Banner */}
                {isCrit && (
                  <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                    <Trophy className="h-3.5 w-3.5 text-amber-400" />
                    <span>NATURAL 20 — CRITICAL HIT!</span>
                  </div>
                )}

                {isFail && (
                  <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-red-600/20 border border-red-600/40 px-2 py-0.5 text-[11px] font-bold text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    <span>NATURAL 1 — CRITICAL FAILURE!</span>
                  </div>
                )}

                {/* Bottom: Breakdown & Total */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-neutral-400 font-mono">
                    <span>[</span>
                    <span className="text-neutral-200 font-bold">
                      {roll.individualResults && roll.individualResults.length > 0
                        ? roll.individualResults.join(", ")
                        : roll.total}
                    </span>
                    <span>]</span>

                    {roll.modifier !== 0 && (
                      <span className="text-amber-400">
                        {roll.modifier > 0 ? ` + ${roll.modifier}` : ` - ${Math.abs(roll.modifier)}`}
                      </span>
                    )}
                  </div>

                  {/* Total Result */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] uppercase font-mono text-neutral-500">
                      Total:
                    </span>
                    <span
                      className={`font-mono text-lg font-extrabold leading-none ${
                        isCrit
                          ? "text-amber-300"
                          : isFail
                          ? "text-red-400"
                          : "text-neutral-100"
                      }`}
                    >
                      {roll.total}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default RollHistory;
