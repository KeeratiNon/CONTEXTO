import fs from "node:fs";
import { SECRETS_PATH, VOCAB_PATH } from "./paths";

const SIMPLE_ING_NOUNS = new Set([
  "morning",
  "evening",
  "building",
  "wedding",
  "feeling",
  "meaning",
  "warning",
  "painting",
  "meeting",
  "beginning",
  "ceiling",
  "clothing",
]);

export function normalizeWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

export function isValidWord(word: string): boolean {
  return /^[a-z]{2,20}$/.test(word);
}

export function isSimpleWord(word: string): boolean {
  if (word.length < 3 || word.length > 10) return false;
  if (SIMPLE_ING_NOUNS.has(word)) return true;
  if (word.endsWith("ing") && word.length > 5) return false;
  if (word.endsWith("ed") && word.length > 5) return false;
  if (word.endsWith("ly") && word.length > 4) return false;
  return true;
}

export function readWordList(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  const unique = new Set<string>();
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const word = normalizeWord(line);
    if (isValidWord(word) && word.length >= 3) unique.add(word);
  }
  return [...unique];
}

export function loadVocabulary(): string[] {
  const words = new Set(readWordList(VOCAB_PATH));
  for (const word of readWordList(SECRETS_PATH)) words.add(word);
  return [...words].sort();
}

export function loadSecrets(): string[] {
  const vocab = new Set(loadVocabulary());
  return readWordList(SECRETS_PATH).filter((word) => vocab.has(word));
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pickDailySecret(date: string, secrets: string[]): string {
  if (secrets.length === 0) {
    throw new Error("No secret words available. Check data/secrets.txt");
  }
  return secrets[hashString(`contexto-daily:${date}`) % secrets.length];
}

export function pickUnlimitedSecret(secrets: string[], avoid?: string): string {
  if (secrets.length === 0) {
    throw new Error("No secret words available. Check data/secrets.txt");
  }
  const pool = avoid ? secrets.filter((word) => word !== avoid) : secrets;
  const list = pool.length > 0 ? pool : secrets;
  return list[Math.floor(Math.random() * list.length)];
}
