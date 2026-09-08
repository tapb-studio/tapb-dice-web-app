import crypto from "crypto";
import Database from "better-sqlite3";
import { getDb } from "./db";

export type DiceType = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

export const VALID_DICE_TYPES: DiceType[] = [
  "d4",
  "d6",
  "d8",
  "d10",
  "d12",
  "d20",
  "d100",
];

export const DICE_MAX_VALUES: Record<DiceType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};

export interface RollResult {
  diceType: string;
  count: number;
  modifier: number;
  notation: string; // e.g. "2d20+3" or "1d6"
  individualResults: number[];
  subtotal: number;
  total: number;
  isCritHit: boolean; // d20 rolling 20
  isCritFail: boolean; // d20 rolling 1
}

export interface UserRef {
  id: string;
  name: string;
  username?: string;
}

export interface SavedDiceRoll {
  id: string;
  roomId: string;
  user: UserRef;
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

/**
 * Calculates a dice roll with the specified dice type, count, and modifier.
 * Validates count (1..20) and modifier (-100..100).
 */
export function calculateRoll(
  diceType: string,
  count: number = 1,
  modifier: number = 0,
  rng: () => number = Math.random
): RollResult {
  if (count === undefined || count === null) count = 1;
  if (modifier === undefined || modifier === null) modifier = 0;

  if (typeof diceType !== "string") {
    throw new Error(
      `Invalid dice type: ${diceType}. Supported types: ${VALID_DICE_TYPES.join(", ")}`
    );
  }

  const normalizedType = diceType.toLowerCase() as DiceType;
  if (!VALID_DICE_TYPES.includes(normalizedType)) {
    throw new Error(
      `Invalid dice type: ${diceType}. Supported types: ${VALID_DICE_TYPES.join(", ")}`
    );
  }

  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error("Dice count must be an integer between 1 and 20");
  }

  if (!Number.isInteger(modifier) || modifier < -100 || modifier > 100) {
    throw new Error("Modifier must be an integer between -100 and 100");
  }

  const max = DICE_MAX_VALUES[normalizedType];
  const individualResults: number[] = [];

  for (let i = 0; i < count; i++) {
    const raw = rng();
    const val = Math.floor(raw * max) + 1;
    individualResults.push(Math.min(val, max));
  }

  const subtotal = individualResults.reduce((acc, curr) => acc + curr, 0);
  const total = subtotal + modifier;

  let notation = `${count}${normalizedType}`;
  if (modifier > 0) {
    notation += `+${modifier}`;
  } else if (modifier < 0) {
    notation += `${modifier}`;
  }

  const hasNat20 = normalizedType === "d20" && individualResults.includes(20);
  const hasNat1 = normalizedType === "d20" && individualResults.includes(1);
  const isCritHit = hasNat20;
  const isCritFail = !hasNat20 && hasNat1;

  return {
    diceType: normalizedType,
    count,
    modifier,
    notation,
    individualResults,
    subtotal,
    total,
    isCritHit,
    isCritFail,
  };
}

/**
 * Parses a standard D&D dice notation string (e.g., "2d20+5", "1d6", "d12-3").
 */
export function parseDiceNotation(notation: string): {
  count: number;
  diceType: string;
  modifier: number;
} {
  if (!notation || typeof notation !== "string") {
    throw new Error("Invalid dice notation: notation must be a non-empty string");
  }

  const match = notation.trim().match(/^(\d+)?(d\d+)(?:([+-])(\d+))?$/i);
  if (!match) {
    throw new Error(
      `Invalid dice notation: "${notation}". Expected format like "1d20", "2d6+3", "d12-1"`
    );
  }

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const diceType = match[2].toLowerCase();
  if (!VALID_DICE_TYPES.includes(diceType as DiceType)) {
    throw new Error(
      `Invalid dice notation: unsupported dice type "${diceType}". Supported types: ${VALID_DICE_TYPES.join(", ")}`
    );
  }
  const modifier =
    match[3] && match[4]
      ? match[3] === "-"
        ? -parseInt(match[4], 10)
        : parseInt(match[4], 10)
      : 0;

  return { count, diceType, modifier };
}

/**
 * Saves a dice roll result to the SQLite database in dice_rolls table.
 */
export function saveRollToDb(
  roomId: string,
  user: { id: string; name: string; username?: string },
  roll: RollResult,
  db?: Database.Database
): SavedDiceRoll {
  if (!roomId || typeof roomId !== "string" || roomId.trim() === "") {
    throw new Error("Room ID is required");
  }
  if (
    !user ||
    !user.id ||
    !user.name ||
    typeof user.id !== "string" ||
    user.id.trim() === "" ||
    typeof user.name !== "string" ||
    user.name.trim() === ""
  ) {
    throw new Error("User with id and name is required");
  }

  const targetDb = db || getDb();
  const rollId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const stmt = targetDb.prepare(`
    INSERT INTO dice_rolls (
      id,
      room_id,
      user_id,
      user_name,
      notation,
      dice_type,
      dice_count,
      modifier,
      individual_results,
      total,
      is_crit_hit,
      is_crit_fail,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    rollId,
    roomId,
    user.id,
    user.name,
    roll.notation,
    roll.diceType,
    roll.count,
    roll.modifier,
    JSON.stringify(roll.individualResults),
    roll.total,
    roll.isCritHit ? 1 : 0,
    roll.isCritFail ? 1 : 0,
    createdAt
  );

  return {
    id: rollId,
    roomId,
    user: {
      id: user.id,
      name: user.name,
      ...(user.username ? { username: user.username } : {}),
    },
    diceType: roll.diceType,
    count: roll.count,
    modifier: roll.modifier,
    notation: roll.notation,
    individualResults: roll.individualResults,
    total: roll.total,
    isCritHit: roll.isCritHit,
    isCritFail: roll.isCritFail,
    createdAt,
  };
}
