import fs from "node:fs";
import * as lancedb from "@lancedb/lancedb";
import { LANCEDB_DIR, META_PATH, RANKS_DIR } from "./paths";
import type { RankCache, SeedMeta } from "./types";
import { GameError } from "./types";

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
  __contextoDb?: Promise<lancedb.Connection>;
};

export async function getDb(): Promise<lancedb.Connection> {
  if (!globalForDb.__contextoDb) {
    globalForDb.__contextoDb = lancedb.connect(LANCEDB_DIR);
  }
  return globalForDb.__contextoDb;
}

export function readSeedMeta(): SeedMeta | null {
  if (!fs.existsSync(META_PATH)) return null;
  return JSON.parse(fs.readFileSync(META_PATH, "utf8")) as SeedMeta;
}

export function requireSeedMeta(): SeedMeta {
  const meta = readSeedMeta();
  if (!meta) {
    throw new GameError(
      "not_seeded",
      "Vector database is empty. Run npm run seed first.",
      503,
    );
  }
  return meta;
}

export async function getWordsTable() {
  requireSeedMeta();
  const db = await getDb();
  return db.openTable("words");
}

export async function getWordVector(word: string): Promise<number[] | null> {
  const table = await getWordsTable();
  const rows = (await table
    .query()
    .where(`word = '${word.replaceAll("'", "''")}'`)
    .limit(1)
    .toArray()) as WordRow[];
  return toNumberArray(rows[0]?.vector);
}

export async function rankAllWords(secret: string): Promise<Map<string, number>> {
  const meta = requireSeedMeta();
  const table = await getWordsTable();
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
  const scored = others.map((row) => {
    let dot = 0;
    for (let i = 0; i < query.length; i += 1) {
      dot += query[i] * row.vector[i];
    }
    return { word: row.word, score: dot };
  });
  scored.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));

  const ranks = new Map<string, number>();
  ranks.set(secret, 1);
  scored.forEach((row, index) => {
    if (!ranks.has(row.word)) ranks.set(row.word, index + 2);
  });
  return ranks;
}

function ranksPath(puzzleId: string): string {
  return `${RANKS_DIR}/${puzzleId.replaceAll("/", "_")}.json`;
}

export async function getCachedRanks(puzzleId: string, secret: string): Promise<Map<string, number>> {
  fs.mkdirSync(RANKS_DIR, { recursive: true });
  const file = ranksPath(puzzleId);

  if (fs.existsSync(file)) {
    const cached = JSON.parse(fs.readFileSync(file, "utf8")) as RankCache;
    if (cached.secret === secret) {
      return new Map(Object.entries(cached.ranks));
    }
  }

  const ranks = await rankAllWords(secret);
  const payload: RankCache = {
    puzzleId,
    secret,
    ranks: Object.fromEntries(ranks),
  };
  fs.writeFileSync(file, JSON.stringify(payload));
  return ranks;
}
