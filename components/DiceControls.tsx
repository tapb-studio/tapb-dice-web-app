"use client";

import React, { useState } from "react";
import { Dices, Minus, Plus, RotateCcw, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export type DiceType = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

export const AVAILABLE_DICE: { type: DiceType; label: string; sides: number }[] = [
  { type: "d4", label: "D4", sides: 4 },
  { type: "d6", label: "D6", sides: 6 },
  { type: "d8", label: "D8", sides: 8 },
  { type: "d10", label: "D10", sides: 10 },
  { type: "d12", label: "D12", sides: 12 },
  { type: "d20", label: "D20", sides: 20 },
  { type: "d100", label: "D100", sides: 100 },
];

export interface DiceControlsProps {
  onRoll: (diceType: DiceType, count: number, modifier: number) => void;
  disabled?: boolean;
  className?: string;
}

export function DiceControls({
  onRoll,
  disabled = false,
  className = "",
}: DiceControlsProps) {
  const { t } = useLanguage();
  const [selectedDice, setSelectedDice] = useState<DiceType>("d20");
  const [count, setCount] = useState<number>(1);
  const [modifier, setModifier] = useState<number>(0);

  const handleCountChange = (delta: number) => {
    setCount((prev) => Math.min(20, Math.max(1, prev + delta)));
  };

  const handleModifierChange = (delta: number) => {
    setModifier((prev) => Math.min(100, Math.max(-100, prev + delta)));
  };

  const handleRoll = () => {
    if (disabled) return;
    onRoll(selectedDice, count, modifier);
  };

  // Build formula display
  const formulaLabel = () => {
    const base = `${count}${selectedDice.toUpperCase()}`;
    if (modifier === 0) return base;
    if (modifier > 0) return `${base} + ${modifier}`;
    return `${base} - ${Math.abs(modifier)}`;
  };

  return (
    <div
      className={`rounded-2xl border border-stone-300/80 dark:border-amber-950/60 bg-white/95 dark:bg-neutral-900/90 p-2.5 sm:p-3 shadow-md dark:shadow-xl transition-colors ${className}`}
    >
      {/* 1. Dice Selector Tabs */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
            {t("diceSelector")}
          </label>
          {selectedDice === "d20" && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setCount((prev) => (prev === 2 ? 1 : 2));
              }}
              className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3" />
              <span>{count === 2 ? "1d20 Standard" : "2d20 Advantage"}</span>
            </button>
          )}
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {AVAILABLE_DICE.map((dice) => {
            const isSelected = selectedDice === dice.type;
            return (
              <button
                key={dice.type}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedDice(dice.type)}
                className={`flex flex-col items-center justify-center py-1.5 sm:py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isSelected
                    ? "border-amber-600 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-400/50 scale-[1.02]"
                    : "border-stone-300 bg-stone-100/90 dark:border-neutral-800 dark:bg-neutral-950/60 text-stone-700 dark:text-neutral-400 hover:border-amber-400 hover:bg-amber-50/60 dark:hover:border-neutral-700 hover:text-stone-950 dark:hover:text-neutral-200"
                } disabled:opacity-50`}
              >
                <span>{dice.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Count, Modifier & Cast Button (Responsive 2-Col on mobile, 1-Row on sm+) */}
      <div className="grid grid-cols-2 sm:flex sm:flex-nowrap items-center gap-1.5 sm:gap-2 mt-2">
        {/* Dice Count */}
        <div className="flex items-center justify-between gap-1 rounded-xl border border-stone-300/80 dark:border-neutral-800 bg-stone-100/90 dark:bg-neutral-950/60 px-2 sm:px-2.5 py-1 h-9 sm:h-10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-neutral-400">
            {t("count")}:
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={disabled || count <= 1}
              onClick={() => handleCountChange(-1)}
              className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg border border-stone-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 hover:border-amber-400 hover:text-stone-900 dark:hover:border-neutral-700 dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
              aria-label="Decrease dice count"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-5 text-center font-mono text-xs sm:text-sm font-extrabold text-amber-800 dark:text-amber-200">
              {count}
            </span>
            <button
              type="button"
              disabled={disabled || count >= 20}
              onClick={() => handleCountChange(1)}
              className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg border border-stone-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 hover:border-amber-400 hover:text-stone-900 dark:hover:border-neutral-700 dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
              aria-label="Increase dice count"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Modifier */}
        <div className="flex items-center justify-between gap-1 rounded-xl border border-stone-300/80 dark:border-neutral-800 bg-stone-100/90 dark:bg-neutral-950/60 px-2 sm:px-2.5 py-1 h-9 sm:h-10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-neutral-400">
            {t("modifier")}:
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={disabled || modifier <= -100}
              onClick={() => handleModifierChange(-1)}
              className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg border border-stone-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 hover:border-amber-400 hover:text-stone-900 dark:hover:border-neutral-700 dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
              aria-label="Decrease modifier"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 sm:w-7 text-center font-mono text-xs sm:text-sm font-extrabold text-amber-800 dark:text-amber-200">
              {modifier > 0 ? `+${modifier}` : modifier}
            </span>
            <button
              type="button"
              disabled={disabled || modifier >= 100}
              onClick={() => handleModifierChange(1)}
              className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg border border-stone-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 hover:border-amber-400 hover:text-stone-900 dark:hover:border-neutral-700 dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
              aria-label="Increase modifier"
            >
              <Plus className="h-3 w-3" />
            </button>
            {modifier !== 0 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setModifier(0)}
                title="Reset modifier"
                className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg border border-stone-300 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 text-stone-400 hover:text-stone-700 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Large Roll Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={handleRoll}
          className="col-span-2 sm:flex-1 sm:min-w-[140px] h-9 sm:h-10 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-500 text-white dark:text-neutral-950 font-bold shadow-md shadow-amber-600/20 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <Dices className={`h-4 w-4 stroke-[2.2] ${disabled ? "animate-spin" : ""}`} />
          <span className="font-mono text-xs sm:text-sm uppercase tracking-wider truncate">
            {disabled ? t("rolling") : `${t("castDice")} (${formulaLabel()})`}
          </span>
        </button>
      </div>
    </div>
  );
}

export default DiceControls;
