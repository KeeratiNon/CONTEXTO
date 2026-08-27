import fs from "node:fs";
import * as lancedb from "@lancedb/lancedb";
import { pathsFor } from "./paths";
import { langFromPuzzleId, type GameLang } from "./lang";
import type { RankCache, SeedMeta } from "./types";
import { GameError } from "./types";
import { loadWordSenses, relatednessScore } from "./categories";

type WordRow = {
  word: string;
  vector: unknown;
  _distance?: number;
};

function toNumberArray(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value) && typeof value[0] === "number") return value as number[];
  if (typeof value === "object" && value && "toArray" in value && typeof value.toArray === "function") {
    return Array.from(value.toArray() as ArrayLike<number>);
  }
  if (typeof (value as Iterable<number>)[Symbol.iterator] === "function") {
    return Array.from(value as Iterable<number>);
  }
  return null;
}

const globalForDb = globalThis as unknown as {
  __contextoDb?: Partial<Record<GameLang, Promise<lancedb.Connection>>>;
};

export async function getDb(lang: GameLang): Promise<lancedb.Connection> {
  if (!globalForDb.__contextoDb) globalForDb.__contextoDb = {};
  if (!globalForDb.__contextoDb[lang]) {
    globalForDb.__contextoDb[lang] = lancedb.connect(pathsFor(lang).lancedbDir);
  }
  return globalForDb.__contextoDb[lang];
}

export function readSeedMeta(lang: GameLang): SeedMeta | null {
  const file = pathsFor(lang).metaPath;
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as SeedMeta;
}

export function requireSeedMeta(lang: GameLang): SeedMeta {
  const meta = readSeedMeta(lang);
  if (!meta) {
    throw new GameError(
      "not_seeded",
      lang === "th"
        ? "ยังไม่มีคลังภาษาไทย รัน npm run prepare-data:th ก่อน"
        : "Vector database is empty. Run npm run seed first.",
      503,
    );
  }
  return meta;
}

export async function getWordsTable(lang: GameLang) {
  requireSeedMeta(lang);
  const db = await getDb(lang);
  return db.openTable("words");
}

export const RANK_VERSION = 6;

export async function rankAllWords(secret: string, lang: GameLang): Promise<Map<string, number>> {
  const meta = requireSeedMeta(lang);
  const table = await getWordsTable(lang);
  const count = Math.max(meta.vocabSize, await table.countRows());
  const rows = (await table
    .query()
    .select(["word", "vector"])
    .limit(count)
    .toArray()) as WordRow[];

  let secretVector: number[] | null = null;
  const others: Array<{ word: string; vector: number[] }> = [];
  for (const row of rows) {
    const vector = toNumberArray(row.vector);
    if (!vector) continue;
    if (row.word === secret) {
      secretVector = vector;
      continue;
    }
    others.push({ word: row.word, vector });
  }

  if (!secretVector) {
    throw new GameError("missing_secret", "Secret word is not in the vector database.", 500);
  }

  const query = secretVector;
  const senses = loadWordSenses(lang);
  const secretSense = senses.get(secret);
  const scored = others.map((row) => {
    let dot = 0;
    for (let i = 0; i < query.length; i += 1) {
      dot += query[i] * row.vector[i];
    }
    const otherSense = senses.get(row.word);
    const relatedness =
      secretSense && otherSense ? relatednessScore(secretSense, row.word, otherSense) : 0;
    return { word: row.word, score: dot + relatedness };
  });
  scored.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word, lang === "th" ? "th" : "en"));

  const ranks = new Map<string, number>();
  ranks.set(secret, 1);
  scored.forEach((row, index) => {
    if (!ranks.has(row.word)) ranks.set(row.word, index + 2);
  });
  return ranks;
}

const MAX_RANK_MEM = 8;

const globalForRanks = globalThis as unknown as {
  __contextoRankMem?: Map<string, Map<string, number>>;
  __contextoRankInflight?: Map<string, Promise<Map<string, number>>>;
};

function rankMem() {
  if (!globalForRanks.__contextoRankMem) globalForRanks.__contextoRankMem = new Map();
  return globalForRanks.__contextoRankMem;
}

function rankInflight() {
  if (!globalForRanks.__contextoRankInflight) globalForRanks.__contextoRankInflight = new Map();
  return globalForRanks.__contextoRankInflight;
}

function rankMemKey(lang: GameLang, secret: string) {
  return `${lang}:${secret}:v${RANK_VERSION}`;
}

function rememberRanks(key: string, ranks: Map<string, number>) {
  const mem = rankMem();
  if (mem.has(key)) mem.delete(key);
  mem.set(key, ranks);
  while (mem.size > MAX_RANK_MEM) {
    const oldest = mem.keys().next().value;
    if (oldest === undefined) break;
    mem.delete(oldest);
  }
  return ranks;
}

function puzzleRanksPath(puzzleId: string, lang: GameLang): string {
  return `${pathsFor(lang).ranksDir}/${puzzleId.replaceAll("/", "_")}.json`;
}

function secretRanksPath(secret: string, lang: GameLang): string {
  return `${pathsFor(lang).ranksDir}/secret-${encodeURIComponent(secret)}.json`;
}

function ranksFromCache(file: string, secret: string): Map<string, number> | null {
  if (!fs.existsSync(file)) return null;
  const cached = JSON.parse(fs.readFileSync(file, "utf8")) as RankCache;
  if (cached.secret !== secret || cached.rankVersion !== RANK_VERSION) return null;
  return new Map(Object.entries(cached.ranks));
}

async function loadOrComputeRanks(puzzleId: string, secret: string): Promise<Map<string, number>> {
  const lang = langFromPuzzleId(puzzleId);
  const dir = pathsFor(lang).ranksDir;
  fs.mkdirSync(dir, { recursive: true });
  const bySecret = secretRanksPath(secret, lang);
  const byPuzzle = puzzleRanksPath(puzzleId, lang);

  const cached = ranksFromCache(bySecret, secret) ?? ranksFromCache(byPuzzle, secret);
  if (cached) {
    if (!fs.existsSync(bySecret)) {
      fs.writeFileSync(
        bySecret,
        JSON.stringify({
          puzzleId,
          secret,
          rankVersion: RANK_VERSION,
          ranks: Object.fromEntries(cached),
        } satisfies RankCache),
      );
    }
    return cached;
  }

  const ranks = await rankAllWords(secret, lang);
  const payload: RankCache = {
    puzzleId,
    secret,
    rankVersion: RANK_VERSION,
    ranks: Object.fromEntries(ranks),
  };
  fs.writeFileSync(bySecret, JSON.stringify(payload));
  return ranks;
}

export async function getCachedRanks(puzzleId: string, secret: string): Promise<Map<string, number>> {
  const lang = langFromPuzzleId(puzzleId);
  const key = rankMemKey(lang, secret);
  const hit = rankMem().get(key);
  if (hit) return hit;

  const pending = rankInflight().get(key);
  if (pending) return pending;

  const work = loadOrComputeRanks(puzzleId, secret).then((ranks) => rememberRanks(key, ranks));
  rankInflight().set(key, work);
  try {
    return await work;
  } finally {
    rankInflight().delete(key);
  }
}
