import { nextCluePack } from "./clues";
import { COPY } from "./copy";
import { cluesMatchLang, langFromPuzzleId } from "./lang";
import { GameError, MAX_HINTS } from "./types";
import { normalizeWord } from "./words";
import { getPuzzleRanks, loadPuzzle, nearbyWords, savePuzzle } from "./puzzle";
import type { StoredPuzzle } from "./types";

function hasPreparedClues(puzzle: StoredPuzzle): boolean {
  // Only AI packs count — ignore old template/local caches
  const lang = puzzle.lang ?? langFromPuzzleId(puzzle.id);
  return (
    puzzle.cluesSource === "ai" &&
    puzzle.clues?.length === MAX_HINTS &&
    cluesMatchLang(puzzle.clues, lang)
  );
}

export async function preparePuzzleClues(puzzle: StoredPuzzle): Promise<string[]> {
  if (hasPreparedClues(puzzle) && puzzle.clues) return puzzle.clues;

  const lang = puzzle.lang ?? langFromPuzzleId(puzzle.id);
  const pack = await nextCluePack({
    secret: puzzle.secret,
    lang,
    guessed: [],
  });
  puzzle.clues = pack.planned;
  puzzle.cluesSource = pack.source;
  savePuzzle(puzzle);
  return pack.planned;
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
    if (!hasPreparedClues(puzzle)) {
      throw new GameError(
        "hint_unavailable",
        lang === "th" ? "คำใบ้ยังไม่พร้อม" : "Hints are not ready yet.",
        503,
      );
    }
    plannedClues = puzzle.clues!;
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
