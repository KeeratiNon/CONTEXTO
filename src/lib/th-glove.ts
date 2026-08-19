import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import { l2normalize } from "./download";
import { isThaiGuessToken } from "./lang";
import { pathsFor } from "./paths";

export const THAI_GLOVE_MODEL = "th.glove.300d.top70k";
export const THAI_GLOVE_DIMENSIONS = 300;

function candidateFiles() {
  const paths = pathsFor("th");
  return [
    process.env.THAI_GLOVE_FILE,
    paths.thaiGlovePath,
    paths.thaiGloveGzipPath,
    path.join(os.homedir(), "Downloads", "th.glove.300d.top70k.txt"),
  ].filter((file): file is string => Boolean(file));
}

function isUsableFile(file: string) {
  return fs.existsSync(file) && fs.statSync(file).size > 1_000_000;
}

export function resolveThaiGloveFile() {
  for (const file of candidateFiles()) {
    if (isUsableFile(file)) return file;
  }
  throw new Error(
    "Missing Thai GloVe file. Commit data/th/th.glove.300d.top70k.txt.gz or set THAI_GLOVE_FILE.",
  );
}

export async function ensureThaiGloveCache() {
  const dest = pathsFor("th").thaiGlovePath;
  if (isUsableFile(dest)) return dest;

  const source = resolveThaiGloveFile();
  if (path.resolve(source) === path.resolve(dest)) return dest;

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  if (source.endsWith(".gz")) {
    console.log(`Extracting ${path.basename(source)} → ${dest}`);
    await pipeline(fs.createReadStream(source), zlib.createGunzip(), fs.createWriteStream(tmp));
  } else {
    console.log(`Copying ${path.basename(source)} → ${dest}`);
    fs.copyFileSync(source, tmp);
  }
  fs.renameSync(tmp, dest);
  return dest;
}

function isHeader(line: string) {
  const parts = line.trim().split(/\s+/);
  return parts.length === 2 && parts.every((part) => /^\d+$/.test(part));
}

function parseLine(line: string): { word: string; values: number[] } | null {
  const space = line.indexOf(" ");
  if (space <= 0) return null;
  const word = line.slice(0, space);
  const values = line.slice(space + 1).split(" ").map(Number);
  if (values.length !== THAI_GLOVE_DIMENSIONS || values.some((value) => !Number.isFinite(value))) {
    return null;
  }
  return { word, values };
}

async function* iterateThaiGloveLines(file: string) {
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const input = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });
  try {
    let first = true;
    for await (const line of input) {
      if (!line) continue;
      if (first) {
        first = false;
        if (isHeader(line)) continue;
      }
      yield line;
    }
  } finally {
    input.close();
    stream.destroy();
  }
}

export async function listThaiGloveGuessableWords(): Promise<string[]> {
  const file = await ensureThaiGloveCache();
  const words: string[] = [];
  const seen = new Set<string>();
  for await (const line of iterateThaiGloveLines(file)) {
    const parsed = parseLine(line);
    if (!parsed || !isThaiGuessToken(parsed.word) || seen.has(parsed.word)) continue;
    seen.add(parsed.word);
    words.push(parsed.word);
  }
  return words;
}

export async function loadThaiGloveVectors(wanted: Set<string>): Promise<Map<string, number[]>> {
  const file = await ensureThaiGloveCache();
  const vectors = new Map<string, number[]>();
  for await (const line of iterateThaiGloveLines(file)) {
    const parsed = parseLine(line);
    if (!parsed || !wanted.has(parsed.word)) continue;
    vectors.set(parsed.word, l2normalize(parsed.values));
    if (vectors.size === wanted.size) break;
  }
  return vectors;
}
