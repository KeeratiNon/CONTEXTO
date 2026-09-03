import { COPY } from "./copy";
import { todayDate } from "./date";
import { langFromPuzzleId, type GameLang } from "./lang";
import { GameError, MAX_HINTS, type GameMode, type PuzzleMeta, type StoredPuzzle } from "./types";
import { getCachedRanks, requireSeedMeta } from "./vectordb";
import { normalizeWord } from "./words";
import {
  createUnlimitedPuzzle,
  getOrCreateDailyPuzzle,
  getPuzzleRanks,
  hydratePuzzleClues,
  loadPuzzle,
  nearbyWords,
  toPuzzleMeta,
} from "./puzzle";

const globalForHints = globalThis as unknown as {
  __contextoHintInflight?: Map<string, Promise<string[]>>;
};

function hintInflight() {
  if (!globalForHints.__contextoHintInflight) {
    globalForHints.__contextoHintInflight = new Map();
  }
  return globalForHints.__contextoHintInflight;
}

async function generatePuzzleClues(puzzle: StoredPuzzle): Promise<string[]> {
  const existing = hydratePuzzleClues(puzzle);
  if (existing) return existing;

  const lang = puzzle.lang ?? langFromPuzzleId(puzzle.id);
  throw new GameError(
    "hint_unavailable",
    lang === "th"
      ? "ยังไม่มีคำใบ้ที่เตรียมไว้ รัน npm run prepare:th"
      : "Prepared hints are missing. Run npm run prepare:th.",
    503,
  );
}

export async function preparePuzzleClues(puzzle: StoredPuzzle): Promise<string[]> {
  const lang = puzzle.lang ?? langFromPuzzleId(puzzle.id);
  const key = `${lang}:${puzzle.secret}`;
  const pending = hintInflight().get(key);
  if (pending) return pending;

  const work = generatePuzzleClues(puzzle);
  hintInflight().set(key, work);
  try {
    return await work;
  } finally {
    hintInflight().delete(key);
  }
}

/** Start-game flow: vectors → secret → hints + ranks → ready to play. */
export async function startGame(
  mode: GameMode,
  date?: string,
  lang: GameLang = "en",
  secretWord?: string,
  avoidWord?: string,
): Promise<PuzzleMeta> {
  const seed = requireSeedMeta(lang);
  const puzzle =
    mode === "unlimited"
      ? createUnlimitedPuzzle(lang, secretWord, avoidWord)
      : getOrCreateDailyPuzzle(date ?? todayDate(), lang);

  const plannedPromise = preparePuzzleClues(puzzle).catch((error) => {
    console.warn(
      `[hints] startGame prepare failed for ${puzzle.secret}:`,
      error instanceof Error ? error.message : error,
    );
    return hydratePuzzleClues(puzzle) ?? [];
  });

  const [, planned] = await Promise.all([
    getCachedRanks(puzzle.id, puzzle.secret),
    plannedPromise,
  ]);

  return toPuzzleMeta(
    puzzle,
    seed.vocabSize,
    planned.length === MAX_HINTS ? planned : undefined,
  );
}

export async function submitGuess(puzzleId: string, rawWord: string) {
  const lang = langFromPuzzleId(puzzleId);
  const word = normalizeWord(rawWord, lang);
  if (word.length < 2) {
    throw new GameError("invalid_word", lang === "th" ? "พิมพ์คำ" : "Type a word.");
  }

  const { puzzle, ranks } = await getPuzzleRanks(puzzleId);
  const rank = ranks.get(word);
  if (rank === undefined) {
    throw new GameError("unknown_word", COPY[lang].unknownWord);
  }

  const correct = rank === 1;
  return {
    word,
    rank,
    correct,
    secret: correct ? puzzle.secret : undefined,
    nearby: correct ? nearbyWords(ranks) : undefined,
  };
}

export async function submitHint(
  puzzleId: string,
  hintsUsed: number,
  _guessed: string[] = [],
  _revealed: string[] = [],
  planned: string[] = [],
) {
  const lang = langFromPuzzleId(puzzleId);
  if (hintsUsed < 0 || hintsUsed >= MAX_HINTS) {
    throw new GameError(
      "hint_limit",
      lang === "th" ? "ใบ้ครบแล้ว" : `You can use at most ${MAX_HINTS} hints.`,
    );
  }

  const puzzle = loadPuzzle(puzzleId);
  let plannedClues = planned.map((clue) => clue.trim()).filter(Boolean);

  if (plannedClues.length !== MAX_HINTS) {
    const resolved = hydratePuzzleClues(puzzle);
    if (!resolved) {
      throw new GameError(
        "hint_unavailable",
        lang === "th" ? "คำใบ้ยังไม่พร้อม" : "Hints are not ready yet.",
        503,
      );
    }
    plannedClues = resolved;
  }

  return {
    clue: plannedClues[hintsUsed],
    index: hintsUsed + 1,
    total: MAX_HINTS,
    clues: plannedClues.slice(0, hintsUsed + 1),
    planned: plannedClues,
  };
}

export async function giveUp(puzzleId: string) {
  const { puzzle, ranks } = await getPuzzleRanks(puzzleId);
  return {
    secret: puzzle.secret,
    rank: 1,
    nearby: nearbyWords(ranks),
  };
}

export async function listNearby(puzzleId: string, limit = 500) {
  const { ranks } = await getPuzzleRanks(puzzleId);
  return { nearby: nearbyWords(ranks, limit) };
}
