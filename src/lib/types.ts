import type { GameLang } from "./lang";

export const MAX_HINTS = 3;
export const HINT_LEVELS = 3;
export const HINTS_PER_LEVEL = 3;
export const HINT_PACK_SIZE = HINT_LEVELS * HINTS_PER_LEVEL;

export type HintLevels = [string[], string[], string[]];

export type HintPack = {
  meaning?: string;
  levels: HintLevels;
};
export type GameMode = "daily" | "unlimited";
export type EmbeddingProvider = "glove" | "fasttext" | "local" | "openai";
export type { GameLang };

export type Guess = {
  word: string;
  rank: number;
  fromHint?: boolean;
};

export type PuzzleMeta = {
  id: string;
  mode: GameMode;
  lang: GameLang;
  date?: string;
  gameNumber?: number;
  vocabSize: number;
  secret: string;
  plannedClues?: string[];
};

export type SeedMeta = {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  vocabSize: number;
  seededAt: string;
};

export type RankCache = {
  puzzleId?: string;
  secret: string;
  ranks: Record<string, number>;
  rankVersion?: number;
};

export type SecretClueCache = {
  secret: string;
  clues: string[];
  cluesSource: "ai";
};

export type PreparedMeta = {
  rankVersion: number;
  vocabSize: number;
  secretCount: number;
};

export type RerankBuckets = {
  close: string[];
  far: string[];
};

export type StoredPuzzle = {
  id: string;
  mode: GameMode;
  lang?: GameLang;
  secret: string;
  date?: string;
  createdAt: string;
  clues?: string[];
  cluesSource?: "ai";
};

export class GameError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
