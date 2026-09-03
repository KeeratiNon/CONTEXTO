/**
 * Precompute Thai hint packs + Groq-checked ranks for every secret.
 *
 *   npm run prepare:th
 *   npm run prepare:th -- --hints-only
 *   npm run prepare:th -- --ranks-only
 *   npm run prepare:th -- --secret ปู
 *   npm run prepare:th -- --limit 5 --force
 *
 * Runtime play only reads these files. Groq is used here, not in production.
 */
import fs from "node:fs";
import path from "node:path";
import { generateHintPackForSecret } from "../src/lib/clues";
import {
  isCompleteHintPack,
  loadHintPack,
  loadRerankBuckets,
  saveHintPack,
  saveRerankBuckets,
  writePreparedRanks,
} from "../src/lib/prepared";
import { applyBuckets, groqRerankBuckets, RERANK_POOL } from "../src/lib/rerank";
import { RANK_VERSION, scoreAllWords } from "../src/lib/vectordb";
import type { RankCache } from "../src/lib/types";
import { pathsFor } from "../src/lib/paths";
import { hasLlm, LlmRateLimitError } from "../src/lib/llm";
import { loadSecrets } from "../src/lib/words";

function loadDotEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ranksFromOrder(secret: string, ordered: string[]): Map<string, number> {
  const ranks = new Map<string, number>();
  ranks.set(secret, 1);
  ordered.forEach((word, index) => {
    if (!ranks.has(word)) ranks.set(word, index + 2);
  });
  return ranks;
}

function writeRuntimeRankCache(secret: string, ranks: Map<string, number>) {
  const dir = pathsFor("th").ranksDir;
  fs.mkdirSync(dir, { recursive: true });
  const payload: RankCache = {
    secret,
    rankVersion: RANK_VERSION,
    ranks: Object.fromEntries(ranks),
  };
  fs.writeFileSync(
    path.join(dir, `secret-${encodeURIComponent(secret)}.json`),
    JSON.stringify(payload),
  );
}

async function prepareHints(secret: string, force: boolean): Promise<boolean> {
  if (!force && loadHintPack(secret, "th")) {
    console.log(`  hints skip ${secret}`);
    return true;
  }
  const pack = await generateHintPackForSecret(secret, "th");
  if (!pack || !isCompleteHintPack(pack)) {
    console.warn(`  hints FAIL ${secret}`);
    return false;
  }
  saveHintPack(secret, "th", pack);
  console.log(`  hints ok ${secret} (${pack.levels.flat().join(" / ")})`);
  return true;
}

function hasGroqRanks(secret: string): boolean {
  const buckets = loadRerankBuckets(secret, "th");
  return Boolean(buckets && (buckets.close.length || buckets.far.length));
}

async function prepareRanks(secret: string, force: boolean): Promise<boolean> {
  const rankPath = path.join(pathsFor("th").preparedRanksDir, `${encodeURIComponent(secret)}.u16.gz`);
  if (!force && fs.existsSync(rankPath) && hasGroqRanks(secret)) {
    console.log(`  ranks skip ${secret}`);
    return true;
  }

  const ordered = await scoreAllWords(secret, "th");
  const pool = ordered.slice(0, RERANK_POOL);
  const rest = ordered.slice(RERANK_POOL);
  let buckets = await groqRerankBuckets(secret, "th", pool);
  if (!buckets) {
    await sleep(1500);
    buckets = await groqRerankBuckets(secret, "th", pool);
  }
  if (!buckets) {
    console.warn(`  ranks FAIL ${secret} — groq empty, not saving`);
    return false;
  }
  saveRerankBuckets(secret, "th", buckets);
  const reranked = [...applyBuckets(secret, "th", pool, buckets), ...rest];
  const ranks = ranksFromOrder(secret, reranked);
  writePreparedRanks(secret, "th", ranks, RANK_VERSION);
  writeRuntimeRankCache(secret, ranks);
  console.log(`  ranks ok ${secret} (${ranks.size} words, close=${buckets.close.length})`);
  return true;
}

async function main() {
  loadDotEnv();
  const lang = "th" as const;
  const hintsOnly = process.argv.includes("--hints-only");
  const ranksOnly = process.argv.includes("--ranks-only");
  const force = process.argv.includes("--force");
  const doHints = !ranksOnly;
  const doRanks = !hintsOnly;
  const limit = Number(argValue("--limit") || 0);
  const only = argValue("--secret");
  const pause = Number(argValue("--sleep") || 400);

  if (doHints && !hasLlm()) {
    throw new Error("GEMINI_API_KEY or GROQ_API_KEY is required to prepare hints.");
  }
  if (doRanks && !hasLlm()) {
    throw new Error("GEMINI_API_KEY or GROQ_API_KEY is required to prepare rank checks.");
  }

  const secrets = loadSecrets(lang);
  const selected = only ? secrets.filter((word) => word === only) : secrets;
  const jobs = limit > 0 ? selected.slice(0, limit) : selected;
  if (!jobs.length) {
    throw new Error(only ? `Secret not in secrets.txt: ${only}` : "No secrets found.");
  }

  console.log(`Preparing ${jobs.length}/${secrets.length} Thai secrets (hints=${doHints} ranks=${doRanks})`);
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < jobs.length; i += 1) {
    const secret = jobs[i];
    console.log(`[${i + 1}/${jobs.length}] ${secret}`);
    try {
      let good = true;
      if (doHints) good = (await prepareHints(secret, force)) && good;
      if (doRanks) good = (await prepareRanks(secret, force)) && good;
      if (good) ok += 1;
      else failed += 1;
    } catch (error) {
      if (error instanceof LlmRateLimitError) {
        console.warn(`Rate limit hit at ${secret}. Stopping so remaining work can resume later.`);
        console.warn(error.message);
        console.log(`Stopped. ok=${ok} failed=${failed} remaining=${jobs.length - i}`);
        process.exit(0);
      }
      throw error;
    }
    if (pause > 0 && i < jobs.length - 1) await sleep(pause);
  }
  console.log(`Done. ok=${ok} failed=${failed}`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
