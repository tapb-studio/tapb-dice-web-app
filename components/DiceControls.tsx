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
      className={`rounded-2xl border border-stone-200 dark:border-amber-950/60 bg-white/80 dark:bg-neutral-900/80 p-4 sm:p-5 backdrop-blur-md shadow-lg dark:shadow-xl transition-colors ${className}`}
    >
      {/* 1. Dice Selector Tabs */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-500/80">
            {t("diceSelector")}
          </label>
          {selectedDice === "d20" && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setCount((prev) => (prev === 2 ? 1 : 2));
              }}
              className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
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
                className={`flex flex-col items-center justify-center py-2 sm:py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isSelected
                    ? "border-amber-500 bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 shadow-md shadow-amber-500/10 ring-2 ring-amber-500/40 scale-[1.03]"
                    : "border-stone-300 dark:border-neutral-800 bg-stone-100 dark:bg-neutral-950/60 text-stone-600 dark:text-neutral-400 hover:border-amber-400 dark:hover:border-neutral-700 hover:text-stone-900 dark:hover:text-neutral-200"
                } disabled:opacity-50`}
              >
                <span>{dice.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Count & Modifier Adjusters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* Dice Count */}
        <div className="flex items-center justify-between rounded-xl border border-stone-200 dark:border-neutral-800 bg-stone-100/90 dark:bg-neutral-950/60 px-3 py-2 transition-colors">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-600 dark:text-neutral-400">
              {t("count")}
            </span>
            <span className="text-xs text-stone-400 dark:text-neutral-500">1 - 20</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled || count <= 1}
              onClick={() => handleCountChange(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 hover:border-amber-400 dark:hover:border-neutral-700 hover:text-stone-900 dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
              aria-label="Decrease dice count"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-8 text-center font-mono text-base font-bold text-amber-700 dark:text-amber-200">
              {count}
            </span>
            <button
              type="button"
              disabled={disabled || count >= 20}
              onClick={() => handleCountChange(1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 hover:border-amber-400 dark:hover:border-neutral-700 hover:text-stone-900 dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
              aria-label="Increase dice count"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Modifier */}
        <div className="flex items-center justify-between rounded-xl border border-stone-200 dark:border-neutral-800 bg-stone-100/90 dark:bg-neutral-950/60 px-3 py-2 transition-colors">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-600 dark:text-neutral-400">
              {t("modifier")}
            </span>
            <span className="text-xs text-stone-400 dark:text-neutral-500">-100 to +100</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={disabled || modifier <= -100}
              onClick={() => handleModifierChange(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 hover:border-amber-400 dark:hover:border-neutral-700 hover:text-stone-900 dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
              aria-label="Decrease modifier"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-10 text-center font-mono text-base font-bold text-amber-700 dark:text-amber-200">
              {modifier > 0 ? `+${modifier}` : modifier}
            </span>
            <button
              type="button"
              disabled={disabled || modifier >= 100}
              onClick={() => handleModifierChange(1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 hover:border-amber-400 dark:hover:border-neutral-700 hover:text-stone-900 dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
              aria-label="Increase modifier"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            {modifier !== 0 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setModifier(0)}
                title="Reset modifier"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-neutral-300 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Large Roll Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleRoll}
        className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 px-6 py-3.5 font-bold text-neutral-950 shadow-xl shadow-amber-600/20 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
      >
        <Dices className={`h-5 w-5 stroke-[2.2] ${disabled ? "animate-spin" : ""}`} />
        <span className="font-mono text-base sm:text-lg uppercase tracking-wider">
          {disabled ? t("rolling") : `${t("castDice")} (${formulaLabel()})`}
        </span>
      </button>
    </div>
  );
}

export default DiceControls;
