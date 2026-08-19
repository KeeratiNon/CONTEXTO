import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { downloadToFile, l2normalize } from "./download";
import { isThaiGuessToken } from "./lang";
import { FASTTEXT_DIR, FASTTEXT_GZ_PATH } from "./paths";

export const FASTTEXT_MODEL = "cc.th.300";
export const FASTTEXT_DIMENSIONS = 300;
export const FASTTEXT_GUESS_TARGET = 70_000;

const FASTTEXT_URLS = [
  "https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.th.300.vec.gz",
];

async function ensureFasttextGz() {
  if (fs.existsSync(FASTTEXT_GZ_PATH) && fs.statSync(FASTTEXT_GZ_PATH).size > 1_000_000) {
    return FASTTEXT_GZ_PATH;
  }
  fs.mkdirSync(FASTTEXT_DIR, { recursive: true });
  let lastError: unknown;
  for (const url of FASTTEXT_URLS) {
    console.log(`Downloading fastText Thai (~1.2GB) from ${url}`);
    try {
      await downloadToFile(url, FASTTEXT_GZ_PATH);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      fs.rmSync(`${FASTTEXT_GZ_PATH}.part`, { force: true });
      fs.rmSync(FASTTEXT_GZ_PATH, { force: true });
    }
  }
  if (lastError) throw lastError;
  return FASTTEXT_GZ_PATH;
}

async function* iterateFasttextLines() {
  const gz = await ensureFasttextGz();
  const stream = fs.createReadStream(gz).pipe(zlib.createGunzip());
  const input = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });
  try {
    let header = true;
    for await (const line of input) {
      if (header) {
        header = false;
        continue;
      }
      if (line) yield line;
    }
  } finally {
    input.close();
    stream.destroy();
  }
}

function parseLine(line: string): { word: string; values: number[] } | null {
  const space = line.indexOf(" ");
  if (space <= 0) return null;
  const word = line.slice(0, space);
  const values = line.slice(space + 1).split(" ").map(Number);
  if (values.length !== FASTTEXT_DIMENSIONS || values.some((value) => !Number.isFinite(value))) {
    return null;
  }
  return { word, values };
}

export async function listThaiGuessableWords(
  limit = FASTTEXT_GUESS_TARGET,
  cachePath?: string,
): Promise<string[]> {
  if (cachePath && fs.existsSync(cachePath)) {
    const cached = fs.readFileSync(cachePath, "utf8").split(/\r?\n/).filter(Boolean);
    if (cached.length >= Math.min(limit, 10_000)) {
      console.log(`Using cached fastText word list (${cached.length} words)`);
      return cached.slice(0, limit);
    }
  }

  const words: string[] = [];
  const seen = new Set<string>();
  for await (const line of iterateFasttextLines()) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    if (!isThaiGuessToken(parsed.word) || seen.has(parsed.word)) continue;
    seen.add(parsed.word);
    words.push(parsed.word);
    if (words.length >= limit) break;
  }

  if (cachePath && words.length > 0) {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, `${words.join("\n")}\n`);
    console.log(`Cached ${words.length} fastText words → ${cachePath}`);
  }

  return words;
}

export async function loadThaiFasttextVectors(wanted: Set<string>): Promise<Map<string, number[]>> {
  const vectors = new Map<string, number[]>();
  for await (const line of iterateFasttextLines()) {
    const parsed = parseLine(line);
    if (!parsed || !wanted.has(parsed.word)) continue;
    vectors.set(parsed.word, l2normalize(parsed.values));
    if (vectors.size === wanted.size) break;
  }
  return vectors;
}
