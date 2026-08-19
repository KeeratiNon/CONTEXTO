import { COPY } from "./copy";
import { langFromPuzzleId } from "./lang";
import { GameError, MAX_HINTS } from "./types";
import { normalizeWord } from "./words";
import { getPuzzleRanks, nearbyWords } from "./puzzle";

const FIRST_HINT_RANK = 80;

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
  guessed: string[],
  hintsUsed: number,
) {
  const lang = langFromPuzzleId(puzzleId);
  if (hintsUsed >= MAX_HINTS) {
    throw new GameError("hint_limit", `You can use at most ${MAX_HINTS} hints.`);
  }

  const { puzzle, ranks } = await getPuzzleRanks(puzzleId);
  const guessedSet = new Set(guessed.map((item) => normalizeWord(item, lang)).filter(Boolean));

  let best = Infinity;
  for (const word of guessedSet) {
    const rank = ranks.get(word);
    if (rank !== undefined) best = Math.min(best, rank);
  }

  const byRank = new Map<number, string>();
  for (const [word, rank] of ranks) byRank.set(rank, word);

  const revealAnswer = () => ({
    word: puzzle.secret,
    rank: 1 as const,
    fromHint: true as const,
    correct: true,
    secret: puzzle.secret,
    nearby: nearbyWords(ranks),
  });

  if (Number.isFinite(best) && best <= 2) {
    return revealAnswer();
  }

  const target = Number.isFinite(best)
    ? Math.ceil(best / 2)
    : FIRST_HINT_RANK;

  if (target <= 1) {
    return revealAnswer();
  }

  for (let rank = target; rank >= 2; rank -= 1) {
    const word = byRank.get(rank);
    if (word && !guessedSet.has(word)) {
      return { word, rank, fromHint: true as const, correct: false };
    }
  }

  return revealAnswer();
}

export async function giveUp(puzzleId: string) {
  const { puzzle, ranks } = await getPuzzleRanks(puzzleId);
  return {
    secret: puzzle.secret,
    rank: 1,
    nearby: nearbyWords(ranks),
  };
}
