"use client";

import React from "react";
import { Trophy, AlertTriangle, ScrollText } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

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
  const { t, language } = useLanguage();

  return (
    <div
      className={`flex flex-col h-full rounded-2xl border border-stone-200 bg-white/80 dark:border-neutral-800 dark:bg-neutral-900/70 backdrop-blur-md overflow-hidden shadow-sm transition-colors ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 bg-stone-50/80 dark:border-neutral-800 dark:bg-neutral-950/50">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          <h3 className="font-serif text-sm font-bold text-stone-800 dark:text-amber-100">
            {t("rollHistory")}
          </h3>
        </div>
        <span className="rounded-full bg-stone-200/80 dark:bg-neutral-800 px-2 py-0.5 text-[11px] font-mono text-stone-600 dark:text-neutral-400">
          {rolls.length} {rolls.length === 1 ? t("singleRollLabel") : t("rollsLabel")}
        </span>
      </div>

      {/* Rolls List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[460px]">
        {rolls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-stone-400 dark:text-neutral-500">
            <ScrollText className="h-8 w-8 text-stone-300 dark:text-neutral-600 mb-2" />
            <p className="text-xs font-medium text-stone-600 dark:text-neutral-400">{t("chronicleUnwritten")}</p>
            <p className="text-[11px] text-stone-400 dark:text-neutral-500 mt-0.5">
              {t("rollDiceToRecordFate")}
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
                    ? "border-amber-500/80 bg-gradient-to-br from-amber-100/90 via-amber-50 to-white dark:from-amber-950/40 dark:via-neutral-900 dark:to-neutral-900 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/40"
                    : isFail
                    ? "border-red-500/80 bg-gradient-to-br from-red-100/90 via-red-50 to-white dark:from-red-950/40 dark:via-neutral-900 dark:to-neutral-900 shadow-md shadow-red-500/10 ring-1 ring-red-600/30"
                    : "border-stone-200 bg-stone-50/70 hover:border-stone-300 dark:border-neutral-800 dark:bg-neutral-950/60 dark:hover:border-neutral-700"
                }`}
              >
                {/* Top: Roller & Time & Formula */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-xs text-stone-800 dark:text-neutral-200 truncate">
                      {roll.userName}
                    </span>
                    <span className="text-[10px] text-stone-400 dark:text-neutral-500 font-mono">
                      {formatRollTime(roll.createdAt)}
                    </span>
                  </div>

                  <span className="shrink-0 rounded bg-stone-200/90 dark:bg-neutral-800/90 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    {roll.notation}
                  </span>
                </div>

                {/* Critical Banner */}
                {isCrit && (
                  <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    <Trophy className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{t("criticalHit")}</span>
                  </div>
                )}

                {isFail && (
                  <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-red-600/15 border border-red-600/30 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                    <span>{t("criticalFail")}</span>
                  </div>
                )}

                {/* Bottom: Breakdown & Total */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-neutral-400 font-mono">
                    <span>[</span>
                    <span className="text-stone-800 dark:text-neutral-200 font-bold">
                      {roll.individualResults && roll.individualResults.length > 0
                        ? roll.individualResults.join(", ")
                        : roll.total}
                    </span>
                    <span>]</span>

                    {roll.modifier !== 0 && (
                      <span className="text-amber-700 dark:text-amber-400 font-semibold">
                        {roll.modifier > 0 ? ` + ${roll.modifier}` : ` - ${Math.abs(roll.modifier)}`}
                      </span>
                    )}
                  </div>

                  {/* Total Result */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] uppercase font-mono text-stone-400 dark:text-neutral-500">
                      {t("total")}:
                    </span>
                    <span
                      className={`font-mono text-lg font-extrabold leading-none ${
                        isCrit
                          ? "text-amber-700 dark:text-amber-300"
                          : isFail
                          ? "text-red-600 dark:text-red-400"
                          : "text-stone-900 dark:text-neutral-100"
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
