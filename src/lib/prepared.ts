import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pathsFor } from "./paths";
import {
  HINT_LEVELS,
  HINTS_PER_LEVEL,
  MAX_HINTS,
  type GameLang,
  type HintLevels,
  type HintPack,
  type PreparedMeta,
  type RerankBuckets,
} from "./types";
import { hashString, loadVocabulary } from "./words";

function readJsonFile<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

export function isCompleteHintPack(pack: HintPack | null | undefined): pack is HintPack {
  if (!pack?.levels || pack.levels.length !== HINT_LEVELS) return false;
  return pack.levels.every(
    (level) =>
      Array.isArray(level) &&
      level.length === HINTS_PER_LEVEL &&
      level.every((hint) => typeof hint === "string" && hint.trim().length >= 2),
  );
}

export function loadHintPacks(lang: GameLang): Record<string, HintPack> {
  return readJsonFile(pathsFor(lang).hintPacksPath, {});
}

export function loadHintPack(secret: string, lang: GameLang): HintPack | null {
  const pack = loadHintPacks(lang)[secret];
  return isCompleteHintPack(pack) ? pack : null;
}

export function preparedSecretSet(lang: GameLang): Set<string> {
  const ready = new Set<string>();
  for (const [secret, pack] of Object.entries(loadHintPacks(lang))) {
    if (isCompleteHintPack(pack)) ready.add(secret);
  }
  return ready;
}

/** Secrets that can be played with prepared hints. Falls back to the full list if none are ready. */
export function playableSecrets(lang: GameLang, secrets: string[]): string[] {
  const ready = preparedSecretSet(lang);
  if (!ready.size) return secrets;
  const filtered = secrets.filter((word) => ready.has(word));
  return filtered.length ? filtered : secrets;
}

export function saveHintPack(secret: string, lang: GameLang, pack: HintPack) {
  const all = loadHintPacks(lang);
  all[secret] = pack;
  writeJsonFile(pathsFor(lang).hintPacksPath, all);
}

export function pickPlannedClues(pack: HintPack, seed: string): string[] {
  return pack.levels.map((level, index) => {
    const choice = hashString(`${seed}:${index}`) % level.length;
    return level[choice];
  });
}

export function loadRerankBucketsFile(lang: GameLang): Record<string, RerankBuckets> {
  return readJsonFile(pathsFor(lang).rerankBucketsPath, {});
}

export function loadRerankBuckets(secret: string, lang: GameLang): RerankBuckets | null {
  const buckets = loadRerankBucketsFile(lang)[secret];
  if (!buckets) return null;
  if (!Array.isArray(buckets.close) || !Array.isArray(buckets.far)) return null;
  return buckets;
}

export function saveRerankBuckets(secret: string, lang: GameLang, buckets: RerankBuckets) {
  const all = loadRerankBucketsFile(lang);
  all[secret] = {
    close: buckets.close,
    far: buckets.far,
  };
  writeJsonFile(pathsFor(lang).rerankBucketsPath, all);
}

function rankFile(secret: string, lang: GameLang): string {
  return path.join(pathsFor(lang).preparedRanksDir, `${encodeURIComponent(secret)}.u16.gz`);
}

export function loadPreparedMeta(lang: GameLang): PreparedMeta | null {
  const meta = readJsonFile<PreparedMeta | null>(pathsFor(lang).preparedMetaPath, null);
  if (!meta || !meta.rankVersion || !meta.vocabSize) return null;
  return meta;
}

export function savePreparedMeta(lang: GameLang, meta: PreparedMeta) {
  writeJsonFile(pathsFor(lang).preparedMetaPath, meta);
}

export function writePreparedRanks(
  secret: string,
  lang: GameLang,
  ranks: Map<string, number>,
  rankVersion: number,
) {
  const vocab = loadVocabulary(lang);
  const buf = Buffer.alloc(vocab.length * 2);
  for (let i = 0; i < vocab.length; i += 1) {
    buf.writeUInt16LE(ranks.get(vocab[i]) ?? 0, i * 2);
  }
  const dir = pathsFor(lang).preparedRanksDir;
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${rankFile(secret, lang)}.tmp`;
  fs.writeFileSync(tmp, zlib.gzipSync(buf, { level: 9 }));
  fs.renameSync(tmp, rankFile(secret, lang));

  const existing = loadPreparedMeta(lang);
  savePreparedMeta(lang, {
    rankVersion,
    vocabSize: vocab.length,
    secretCount: Math.max(existing?.secretCount ?? 0, fs.readdirSync(dir).filter((name) => name.endsWith(".u16.gz")).length),
  });
}

export function readPreparedRanks(
  secret: string,
  lang: GameLang,
  rankVersion: number,
): Map<string, number> | null {
  const meta = loadPreparedMeta(lang);
  if (meta && meta.rankVersion !== rankVersion) return null;
  const file = rankFile(secret, lang);
  if (!fs.existsSync(file)) return null;
  const vocab = loadVocabulary(lang);
  if (meta && meta.vocabSize !== vocab.length) return null;
  const buf = zlib.gunzipSync(fs.readFileSync(file));
  if (buf.length !== vocab.length * 2) return null;
  const ranks = new Map<string, number>();
  for (let i = 0; i < vocab.length; i += 1) {
    const rank = buf.readUInt16LE(i * 2);
    if (rank > 0) ranks.set(vocab[i], rank);
  }
  if (ranks.get(secret) !== 1 || ranks.size < MAX_HINTS) return null;
  return ranks;
}
