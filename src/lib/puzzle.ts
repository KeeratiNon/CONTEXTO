import fs from "node:fs";
import crypto from "node:crypto";
import { PUZZLES_DIR } from "./paths";
import { GameError, type GameMode, type PuzzleMeta, type StoredPuzzle } from "./types";
import { gameNumberForDate } from "./date";
import { loadSecrets, pickDailySecret, pickUnlimitedSecret } from "./words";
import { getCachedRanks, requireSeedMeta } from "./vectordb";

function puzzlePath(id: string): string {
  return `${PUZZLES_DIR}/${id.replaceAll("/", "_")}.json`;
}

function readPuzzle(id: string): StoredPuzzle | null {
  const file = puzzlePath(id);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as StoredPuzzle;
}

function writePuzzle(puzzle: StoredPuzzle) {
  fs.mkdirSync(PUZZLES_DIR, { recursive: true });
  fs.writeFileSync(puzzlePath(puzzle.id), JSON.stringify(puzzle, null, 2));
}

export function getOrCreateDailyPuzzle(date: string): StoredPuzzle {
  const id = `daily-${date}`;
  const existing = readPuzzle(id);
  if (existing) return existing;

  const secret = pickDailySecret(date, loadSecrets());
  const puzzle: StoredPuzzle = {
    id,
    mode: "daily",
    secret,
    date,
    createdAt: new Date().toISOString(),
  };
  writePuzzle(puzzle);
  return puzzle;
}

export function createUnlimitedPuzzle(): StoredPuzzle {
  const id = `ul-${crypto.randomUUID()}`;
  const secret = pickUnlimitedSecret(loadSecrets());
  const puzzle: StoredPuzzle = {
    id,
    mode: "unlimited",
    secret,
    createdAt: new Date().toISOString(),
  };
  writePuzzle(puzzle);
  return puzzle;
}

export function loadPuzzle(puzzleId: string): StoredPuzzle {
  if (puzzleId.startsWith("daily-")) {
    const date = puzzleId.slice("daily-".length);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new GameError("invalid_puzzle", "Invalid daily puzzle id.");
    }
    return getOrCreateDailyPuzzle(date);
  }

  const puzzle = readPuzzle(puzzleId);
  if (!puzzle) {
    throw new GameError("invalid_puzzle", "Puzzle not found.", 404);
  }
  return puzzle;
}

export function toPuzzleMeta(puzzle: StoredPuzzle, vocabSize: number): PuzzleMeta {
  return {
    id: puzzle.id,
    mode: puzzle.mode,
    date: puzzle.date,
    gameNumber: puzzle.date ? gameNumberForDate(puzzle.date) : undefined,
    vocabSize,
  };
}

export async function openPuzzle(
  mode: GameMode,
  date?: string,
): Promise<{ meta: PuzzleMeta; puzzle: StoredPuzzle }> {
  const seed = requireSeedMeta();
  const puzzle =
    mode === "unlimited"
      ? createUnlimitedPuzzle()
      : getOrCreateDailyPuzzle(date ?? new Date().toISOString().slice(0, 10));

  await getCachedRanks(puzzle.id, puzzle.secret);
  return { meta: toPuzzleMeta(puzzle, seed.vocabSize), puzzle };
}

export async function getPuzzleRanks(puzzleId: string) {
  const puzzle = loadPuzzle(puzzleId);
  const ranks = await getCachedRanks(puzzle.id, puzzle.secret);
  return { puzzle, ranks };
}

export function nearbyWords(ranks: Map<string, number>, limit = 20) {
  return [...ranks.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([word, rank]) => ({ word, rank }));
}
