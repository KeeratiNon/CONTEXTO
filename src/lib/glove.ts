import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import { GLOVE_DIR, GLOVE_ZIP_PATH } from "./paths";
import { downloadToFile, l2normalize } from "./download";

export const GLOVE_MODEL = "glove.6B.300d";
export const GLOVE_DIMENSIONS = 300;
export const GLOVE_GUESS_TARGET = 70_000;
export const GLOVE_GUESS_MIN_LEN = 3;
export const GLOVE_GUESS_MAX_LEN = 15;

const GLOVE_URLS = [
  "https://huggingface.co/stanfordnlp/glove/resolve/main/glove.6B.zip",
  "https://nlp.stanford.edu/data/glove.6B.zip",
];

const ZIP_EOCD = 0x06054b50;
const ZIP_CD = 0x02014b50;
const ZIP_LOCAL = 0x04034b50;

function vectorsPath() {
  return path.join(GLOVE_DIR, `${GLOVE_MODEL}.txt`);
}

async function extractZipEntry(zipPath: string, entryName: string, destPath: string) {
  const stat = fs.statSync(zipPath);
  const fd = fs.openSync(zipPath, "r");
  try {
    const tailSize = Math.min(stat.size, 65_535 + 22);
    const tail = Buffer.alloc(tailSize);
    fs.readSync(fd, tail, 0, tailSize, stat.size - tailSize);

    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i -= 1) {
      if (tail.readUInt32LE(i) === ZIP_EOCD) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("Not a zip file (missing EOCD)");

    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    const cd = Buffer.alloc(cdSize);
    fs.readSync(fd, cd, 0, cdSize, cdOffset);

    let cursor = 0;
    let localOffset = -1;
    let compression = 0;
    let compressedSize = 0;
    while (cursor < cd.length) {
      if (cd.readUInt32LE(cursor) !== ZIP_CD) {
        throw new Error("Corrupt zip central directory");
      }
      const nameLen = cd.readUInt16LE(cursor + 28);
      const extraLen = cd.readUInt16LE(cursor + 30);
      const commentLen = cd.readUInt16LE(cursor + 32);
      const name = cd.subarray(cursor + 46, cursor + 46 + nameLen).toString("utf8");
      if (name === entryName || name.endsWith(`/${entryName}`)) {
        compression = cd.readUInt16LE(cursor + 10);
        compressedSize = cd.readUInt32LE(cursor + 20);
        localOffset = cd.readUInt32LE(cursor + 42);
        break;
      }
      cursor += 46 + nameLen + extraLen + commentLen;
    }
    if (localOffset < 0) throw new Error(`Zip is missing ${entryName}`);

    const localHeader = Buffer.alloc(30);
    fs.readSync(fd, localHeader, 0, 30, localOffset);
    if (localHeader.readUInt32LE(0) !== ZIP_LOCAL) {
      throw new Error("Corrupt zip local header");
    }
    const dataStart =
      localOffset + 30 + localHeader.readUInt16LE(26) + localHeader.readUInt16LE(28);
    const source = fs.createReadStream(zipPath, {
      start: dataStart,
      end: dataStart + compressedSize - 1,
    });
    const tmp = `${destPath}.part`;
    const dest = fs.createWriteStream(tmp);
    if (compression === 0) {
      await pipeline(source, dest);
    } else if (compression === 8) {
      await pipeline(source, zlib.createInflateRaw(), dest);
    } else {
      throw new Error(`Unsupported zip compression ${compression}`);
    }
    fs.renameSync(tmp, destPath);
  } finally {
    fs.closeSync(fd);
  }
}

async function ensureExtracted() {
  const txt = vectorsPath();
  if (fs.existsSync(txt) && fs.statSync(txt).size > 1_000_000) return txt;

  fs.mkdirSync(GLOVE_DIR, { recursive: true });
  if (!fs.existsSync(GLOVE_ZIP_PATH) || fs.statSync(GLOVE_ZIP_PATH).size < 1_000_000) {
    let lastError: unknown;
    for (const url of GLOVE_URLS) {
      console.log(`Downloading GloVe 6B (~822MB) from ${url}`);
      try {
        await downloadToFile(url, GLOVE_ZIP_PATH);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        fs.rmSync(`${GLOVE_ZIP_PATH}.part`, { force: true });
        fs.rmSync(GLOVE_ZIP_PATH, { force: true });
      }
    }
    if (lastError) throw lastError;
  }

  console.log(`Extracting ${GLOVE_MODEL}.txt...`);
  await extractZipEntry(GLOVE_ZIP_PATH, `${GLOVE_MODEL}.txt`, txt);
  fs.rmSync(GLOVE_ZIP_PATH, { force: true });
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
  const file = await ensureExtracted();
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
  const file = await ensureExtracted();
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
