import fs from "node:fs";
import crypto from "node:crypto";
import { pathsFor } from "./paths";
import { GameError, MAX_HINTS, type GameLang, type GameMode, type PuzzleMeta, type SecretClueCache, type StoredPuzzle } from "./types";
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

function cluePackPath(secret: string, lang: GameLang): string {
  return `${pathsFor(lang).cluesDir}/${encodeURIComponent(secret)}.json`;
}

export function usableAiClues(
  clues: string[] | undefined,
  source: StoredPuzzle["cluesSource"],
  lang: GameLang,
): string[] | null {
  if (source !== "ai" || clues?.length !== MAX_HINTS) return null;
  if (!cluesMatchLang(clues, lang)) return null;
  return clues;
}

function readCluesForSecret(secret: string, lang: GameLang): string[] | null {
  const file = cluePackPath(secret, lang);
  if (!fs.existsSync(file)) return null;
  const cached = JSON.parse(fs.readFileSync(file, "utf8")) as SecretClueCache;
  if (cached.secret !== secret) return null;
  return usableAiClues(cached.clues, cached.cluesSource, lang);
}

export function saveCluesForSecret(secret: string, lang: GameLang, clues: string[]) {
  const dir = pathsFor(lang).cluesDir;
  fs.mkdirSync(dir, { recursive: true });
  const payload: SecretClueCache = { secret, clues, cluesSource: "ai" };
  fs.writeFileSync(cluePackPath(secret, lang), JSON.stringify(payload, null, 2));
}

function findCluesInPuzzles(secret: string, lang: GameLang): string[] | null {
  const dir = pathsFor(lang).puzzlesDir;
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const puzzle = JSON.parse(fs.readFileSync(`${dir}/${name}`, "utf8")) as StoredPuzzle;
    if (puzzle.secret !== secret) continue;
    const clues = usableAiClues(puzzle.clues, puzzle.cluesSource, lang);
    if (clues) return clues;
  }
  return null;
}

/** Reuse AI clues already generated for this secret, even from another puzzle. */
export function hydratePuzzleClues(puzzle: StoredPuzzle): string[] | null {
  const lang = puzzle.lang ?? langFromPuzzleId(puzzle.id);
  const own = usableAiClues(puzzle.clues, puzzle.cluesSource, lang);
  if (own) {
    if (!readCluesForSecret(puzzle.secret, lang)) saveCluesForSecret(puzzle.secret, lang, own);
    return own;
  }

  const shared = readCluesForSecret(puzzle.secret, lang) ?? findCluesInPuzzles(puzzle.secret, lang);
  if (!shared) return null;

  console.info(`[hints] reuse pack for ${puzzle.secret}`);
  saveCluesForSecret(puzzle.secret, lang, shared);
  puzzle.clues = shared;
  puzzle.cluesSource = "ai";
  savePuzzle(puzzle);
  return shared;
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
      usableAiClues(puzzle.clues, puzzle.cluesSource, lang) ??
      undefined,
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
  const planned = hydratePuzzleClues(puzzle) ?? undefined;
  return { meta: toPuzzleMeta(puzzle, seed.vocabSize, planned), puzzle };
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
