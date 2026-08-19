import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { listThaiGloveGuessableWords, THAI_GLOVE_MODEL } from "../src/lib/th-glove";
import { pathsFor } from "../src/lib/paths";
import { isThaiGuessToken } from "../src/lib/lang";
import { THAI_FUNCTION_WORDS, THAI_SECRET_NOUNS } from "./thai-secrets";

const SECRET_MIN_LEN = 2;
const SECRET_MAX_LEN = 10;
const SECRET_TARGET = 400;
const DEFAULT_ZIP = "/Users/non/Downloads/thai-contexto-70k-v4.zip";
const ZIP_JSONL_PATH = "thai-contexto-70k/data/thai-contexto-70k.jsonl";

const SECRET_CATEGORIES = new Set([
  "food",
  "fruit",
  "vegetable",
  "drink",
  "animal",
  "place",
  "object",
  "people",
  "nature",
  "body",
  "city_country",
  "vehicle",
  "clothing",
  "health",
  "color",
]);

type DatasetRow = {
  word: string;
  synsets: string[];
  core: boolean;
  length: number;
  tier: number;
  category: string;
  source: string;
};

function datasetPath(root: string) {
  return path.join(root, "thai-contexto-70k.jsonl");
}

function ensureDataset(root: string) {
  const dest = datasetPath(root);
  const zip = process.env.THAI_DATASET_ZIP || DEFAULT_ZIP;
  if (fs.existsSync(zip)) {
    console.log(`Extracting dataset from ${path.basename(zip)}...`);
    execFileSync("unzip", ["-p", zip, ZIP_JSONL_PATH], {
      stdio: ["ignore", fs.openSync(dest, "w"), "inherit"],
    });
    return dest;
  }
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1_000_000) {
    console.log(`Using existing ${dest}`);
    return dest;
  }
  throw new Error(
    `Missing ${dest}. Set THAI_DATASET_ZIP to thai-contexto-70k-v4.zip or place thai-contexto-70k.jsonl in ${root}.`,
  );
}

function parseSynsets(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((item) => typeof item === "string");
  if (typeof raw === "string" && raw.trim()) return raw.split("|").filter(Boolean);
  return [];
}

function loadDataset(file: string): DatasetRow[] {
  const rows: DatasetRow[] = [];
  const seen = new Set<string>();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const raw = JSON.parse(line.replace(/:\s*NaN\b/g, ": null")) as {
      word?: string;
      synsets?: unknown;
      core?: number | boolean;
      length?: number;
      tier?: number;
      category?: string;
      source?: string;
    };
    const word = (raw.word ?? "").trim();
    if (!isThaiGuessToken(word) || seen.has(word)) continue;
    seen.add(word);
    rows.push({
      word,
      synsets: parseSynsets(raw.synsets),
      core: Boolean(raw.core),
      length: raw.length ?? word.length,
      tier: raw.tier ?? 3,
      category: raw.category ?? "general",
      source: raw.source ?? "wordnet",
    });
  }
  return rows;
}

function isNoun(row: DatasetRow) {
  return row.synsets.some((id) => id.endsWith("-n"));
}

function isSecretCandidate(row: DatasetRow) {
  if (THAI_FUNCTION_WORDS.has(row.word)) return false;
  if (row.word.length < SECRET_MIN_LEN || row.word.length > SECRET_MAX_LEN) return false;
  if (row.source === "curated" && SECRET_CATEGORIES.has(row.category)) return true;
  if (SECRET_CATEGORIES.has(row.category)) return true;
  if (THAI_SECRET_NOUNS.includes(row.word)) return true;
  return row.tier <= 2 && isNoun(row) && row.category !== "abstract" && row.category !== "feeling";
}

function pickSecrets(rows: DatasetRow[], playable: Set<string>): string[] {
  const byWord = new Map(rows.map((row) => [row.word, row]));
  const picked: string[] = [];
  const used = new Set<string>();

  const takeRow = (row: DatasetRow) => {
    if (used.has(row.word) || !playable.has(row.word) || !isSecretCandidate(row)) return;
    used.add(row.word);
    picked.push(row.word);
  };

  const takeWord = (word: string) => {
    const row = byWord.get(word);
    if (row) takeRow(row);
    else if (playable.has(word) && !THAI_FUNCTION_WORDS.has(word) && !used.has(word)) {
      if (word.length < SECRET_MIN_LEN || word.length > SECRET_MAX_LEN) return;
      used.add(word);
      picked.push(word);
    }
  };

  const ranked = (predicate: (row: DatasetRow) => boolean) =>
    rows
      .filter((row) => playable.has(row.word) && predicate(row) && isSecretCandidate(row))
      .sort(
        (a, b) =>
          (SECRET_CATEGORIES.has(b.category) ? 1 : 0) - (SECRET_CATEGORIES.has(a.category) ? 1 : 0) ||
          a.length - b.length ||
          a.word.localeCompare(b.word, "th"),
      );

  for (const row of ranked((row) => row.source === "curated")) {
    if (picked.length >= SECRET_TARGET) break;
    takeRow(row);
  }
  for (const row of ranked((row) => row.tier === 2 && row.source !== "curated")) {
    if (picked.length >= SECRET_TARGET) break;
    takeRow(row);
  }
  for (const word of THAI_SECRET_NOUNS) {
    if (picked.length >= SECRET_TARGET) break;
    takeWord(word);
  }

  return picked.slice(0, SECRET_TARGET);
}

async function main() {
  const paths = pathsFor("th");
  console.log(`Building Thai vocabulary from ${THAI_GLOVE_MODEL}...`);
  fs.mkdirSync(paths.root, { recursive: true });
  fs.mkdirSync(paths.rawDir, { recursive: true });

  const playableList = await listThaiGloveGuessableWords();
  const playable = new Set(playableList);
  if (playable.size < 10_000) {
    throw new Error(`Thai GloVe word list too small (${playable.size})`);
  }

  const file = ensureDataset(paths.root);
  const rows = loadDataset(file);
  const secrets = pickSecrets(rows, playable);
  const words = [...playable];
  const datasetPlayable = rows.filter((row) => playable.has(row.word)).length;
  const curatedPlayable = rows.filter((row) => row.source === "curated" && playable.has(row.word)).length;

  fs.writeFileSync(paths.vocabPath, `${words.join("\n")}\n`);
  fs.writeFileSync(paths.secretsPath, `${secrets.join("\n")}\n`);
  fs.writeFileSync(
    paths.vocabMetaPath,
    JSON.stringify(
      {
        lang: "th",
        builtAt: new Date().toISOString(),
        sources: [
          {
            name: THAI_GLOVE_MODEL,
            file: "data/th/raw/th.glove.300d.top70k.txt",
            note: "Playable words = Thai tokens with GloVe vectors (same idea as English GloVe 6B)",
          },
          {
            name: "thai-contexto-70k-v4",
            file: "data/th/thai-contexto-70k.jsonl",
            note: "Used to pick everyday secret nouns that also exist in Thai GloVe",
          },
        ],
        counts: {
          vocabulary: words.length,
          secrets: secrets.length,
          datasetPlayable,
          curatedPlayable,
        },
      },
      null,
      2,
    ),
  );

  console.log(`Guessable words: ${words.length} (all have GloVe vectors)`);
  console.log(`Dataset overlap: ${datasetPlayable}/${rows.length}`);
  console.log(`Curated playable: ${curatedPlayable}`);
  console.log(`Secret nouns: ${secrets.length}`);
  console.log("Next: npm run seed:th");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
