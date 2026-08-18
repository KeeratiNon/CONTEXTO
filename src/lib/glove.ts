import { execFileSync } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import { GLOVE_DIR, GLOVE_ZIP_PATH } from "./paths";

export const GLOVE_MODEL = "glove.6B.300d";
export const GLOVE_DIMENSIONS = 300;
export const GLOVE_GUESS_TARGET = 70_000;
export const GLOVE_GUESS_MIN_LEN = 3;
export const GLOVE_GUESS_MAX_LEN = 15;

const GLOVE_URLS = [
  "https://nlp.stanford.edu/data/glove.6B.zip",
  "https://huggingface.co/stanfordnlp/glove/resolve/main/glove.6B.zip",
];

function vectorsPath() {
  return path.join(GLOVE_DIR, `${GLOVE_MODEL}.txt`);
}

function l2normalize(values: number[]): number[] {
  let sumSquares = 0;
  for (const value of values) sumSquares += value * value;
  const norm = Math.sqrt(sumSquares) || 1;
  return values.map((value) => value / norm);
}

function ensureExtracted() {
  const txt = vectorsPath();
  if (fs.existsSync(txt) && fs.statSync(txt).size > 1_000_000) return txt;

  fs.mkdirSync(GLOVE_DIR, { recursive: true });
  if (!fs.existsSync(GLOVE_ZIP_PATH) || fs.statSync(GLOVE_ZIP_PATH).size < 1_000_000) {
    let lastError: unknown;
    for (const url of GLOVE_URLS) {
      console.log(`Downloading GloVe 6B (~822MB) from ${url}`);
      try {
        execFileSync("curl", ["-L", "--fail", "--retry", "3", "-o", GLOVE_ZIP_PATH, url], {
          stdio: "inherit",
        });
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
  }

  console.log(`Extracting ${GLOVE_MODEL}.txt...`);
  execFileSync(
    "unzip",
    ["-o", "-j", GLOVE_ZIP_PATH, `${GLOVE_MODEL}.txt`, "-d", GLOVE_DIR],
    { stdio: "inherit" },
  );
  return txt;
}

export function isGloveGuessToken(word: string): boolean {
  if (word.length < GLOVE_GUESS_MIN_LEN || word.length > GLOVE_GUESS_MAX_LEN) return false;
  if (!/^[a-z]+$/.test(word)) return false;
  if (!/[aeiouy]/.test(word)) return false;
  if (/(.)\1\1/.test(word)) return false;
  return true;
}

export async function listGloveGuessableWords(limit = GLOVE_GUESS_TARGET): Promise<string[]> {
  const file = ensureExtracted();
  const words: string[] = [];
  const seen = new Set<string>();
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const input = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of input) {
      if (!line) continue;
      const space = line.indexOf(" ");
      const word = space > 0 ? line.slice(0, space) : line;
      if (!isGloveGuessToken(word) || seen.has(word)) continue;
      seen.add(word);
      words.push(word);
      if (words.length >= limit) break;
    }
  } finally {
    input.close();
    stream.destroy();
  }

  return words;
}

export async function loadGloveVectors(wanted: Set<string>): Promise<Map<string, number[]>> {
  const file = ensureExtracted();
  const vectors = new Map<string, number[]>();
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const input = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of input) {
      if (!line) continue;
      const space = line.indexOf(" ");
      if (space <= 0) continue;
      const word = line.slice(0, space);
      if (!wanted.has(word)) continue;
      const values = line.slice(space + 1).split(" ").map(Number);
      if (values.length !== GLOVE_DIMENSIONS || values.some((value) => !Number.isFinite(value))) {
        continue;
      }
      vectors.set(word, l2normalize(values));
      if (vectors.size === wanted.size) break;
    }
  } finally {
    input.close();
    stream.destroy();
  }

  return vectors;
}
