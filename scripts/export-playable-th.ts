/**
 * One-file Thai export: playable words + original GloVe vectors.
 *
 *   npm run export-playable:th
 *
 * Output: data/th/th.glove.300d.playable.txt.gz
 * Format: first line `N 300`, then `word v1 v2 ... v300` (same numbers as the 70k dump)
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import { pathsFor } from "../src/lib/paths";
import { ensureThaiGloveCache } from "../src/lib/th-glove";

function loadPlayableWords(file: string): Set<string> {
  const seen = new Set<string>();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const word = line.trim();
    if (word) seen.add(word);
  }
  return seen;
}

async function main() {
  const paths = pathsFor("th");
  const wanted = loadPlayableWords(paths.vocabPath);
  if (wanted.size < 1000) {
    throw new Error(`Vocabulary too small (${wanted.size}). Run npm run build-vocab:th first.`);
  }

  const source = await ensureThaiGloveCache();
  const lines: string[] = [];
  const used = new Set<string>();
  const stream = fs.createReadStream(source, { encoding: "utf8" });
  const input = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let first = true;
  for await (const line of input) {
    if (!line) continue;
    if (first) {
      first = false;
      const parts = line.trim().split(/\s+/);
      if (parts.length === 2 && parts.every((part) => /^\d+$/.test(part))) continue;
    }
    const word = line.slice(0, line.indexOf(" "));
    if (!wanted.has(word) || used.has(word)) continue;
    used.add(word);
    lines.push(line);
    if (used.size === wanted.size) break;
  }
  input.close();
  stream.destroy();

  const missing = wanted.size - used.size;
  if (missing) console.warn(`Skipped ${missing} words with no GloVe vector`);

  const outPath = path.join(paths.root, "th.glove.300d.playable.txt.gz");
  const gzip = zlib.createGzip({ level: 9 });
  const dest = fs.createWriteStream(outPath);
  const writing = pipeline(gzip, dest);
  gzip.write(`${lines.length} 300\n`);
  for (const line of lines) gzip.write(`${line}\n`);
  gzip.end();
  await writing;

  const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  console.log(`Wrote ${outPath} (${lines.length} words, ${mb}MB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
