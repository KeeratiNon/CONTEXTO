import fs from "node:fs";
import crypto from "node:crypto";
import { pathsFor } from "./paths";
import { GameError, type GameLang, type GameMode, type PuzzleMeta, type StoredPuzzle } from "./types";
import { cluesMatchLang, dailyPuzzleId, langFromPuzzleId, parseDailyPuzzleId } from "./lang";
import { gameNumberForDate } from "./date";
import { loadSecrets, pickDailySecret, pickUnlimitedSecret } from "./words";
import { getCachedRanks, requireSeedMeta } from "./vectordb";

function puzzlePath(id: string, lang: GameLang): string {
  return `${pathsFor(lang).puzzlesDir}/${id.replaceAll("/", "_")}.json`;
}

function readPuzzle(id: string, lang: GameLang): StoredPuzzle | null {
  const file = puzzlePath(id, lang);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as StoredPuzzle;
}

function writePuzzle(puzzle: StoredPuzzle, lang: GameLang) {
  fs.mkdirSync(pathsFor(lang).puzzlesDir, { recursive: true });
  fs.writeFileSync(puzzlePath(puzzle.id, lang), JSON.stringify(puzzle, null, 2));
}

export function getOrCreateDailyPuzzle(date: string, lang: GameLang = "en"): StoredPuzzle {
  const id = dailyPuzzleId(date, lang);
  const existing = readPuzzle(id, lang);
  if (existing) return existing;

  const secret = pickDailySecret(date, loadSecrets(lang), lang);
  const puzzle: StoredPuzzle = {
    id,
    mode: "daily",
    lang,
    secret,
    date,
    createdAt: new Date().toISOString(),
  };
  writePuzzle(puzzle, lang);
  return puzzle;
}

export function createUnlimitedPuzzle(lang: GameLang = "en"): StoredPuzzle {
  const id = lang === "th" ? `ul-th-${crypto.randomUUID()}` : `ul-${crypto.randomUUID()}`;
  const secret = pickUnlimitedSecret(loadSecrets(lang));
  const puzzle: StoredPuzzle = {
    id,
    mode: "unlimited",
    lang,
    secret,
    createdAt: new Date().toISOString(),
  };
  writePuzzle(puzzle, lang);
  return puzzle;
}

export function savePuzzle(puzzle: StoredPuzzle) {
  writePuzzle(puzzle, puzzle.lang ?? langFromPuzzleId(puzzle.id));
}

export function loadPuzzle(puzzleId: string): StoredPuzzle {
  const daily = parseDailyPuzzleId(puzzleId);
  if (daily) return getOrCreateDailyPuzzle(daily.date, daily.lang);

  const lang = langFromPuzzleId(puzzleId);
  const puzzle = readPuzzle(puzzleId, lang);
  if (!puzzle) {
    throw new GameError("invalid_puzzle", "Puzzle not found.", 404);
  }
  return puzzle;
}

export function toPuzzleMeta(
  puzzle: StoredPuzzle,
  vocabSize: number,
  plannedClues?: string[],
): PuzzleMeta {
  const lang = puzzle.lang ?? langFromPuzzleId(puzzle.id);
  return {
    id: puzzle.id,
    mode: puzzle.mode,
    lang,
    date: puzzle.date,
    gameNumber: puzzle.date ? gameNumberForDate(puzzle.date) : undefined,
    vocabSize,
    plannedClues:
      plannedClues ??
      (puzzle.cluesSource === "ai" &&
      puzzle.clues &&
      cluesMatchLang(puzzle.clues, lang)
        ? puzzle.clues
        : undefined),
  };
}

export async function openPuzzle(
  mode: GameMode,
  date?: string,
  lang: GameLang = "en",
): Promise<{ meta: PuzzleMeta; puzzle: StoredPuzzle }> {
  const seed = requireSeedMeta(lang);
  const puzzle =
    mode === "unlimited"
      ? createUnlimitedPuzzle(lang)
      : getOrCreateDailyPuzzle(date ?? new Date().toISOString().slice(0, 10), lang);

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
