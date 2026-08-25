/**
 * Add ranked `categories` tags to data/th/thai-contexto-70k.jsonl.
 * Restore the untagged jsonl from thai-contexto-70k-v4.zip before a clean re-run.
 *
 *   npm run tag-categories:th
 *   npx tsx scripts/tag-categories-th.ts --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { l2normalize } from "../src/lib/download";
import { loadThaiGloveVectors } from "../src/lib/th-glove";
import { pathsFor } from "../src/lib/paths";

const MAX_TAGS = 3;
const WN_WEIGHT = 0.5;
const GLOVE_WEIGHT = 0.45;
const GOLD_BONUS = 0.9;
const SPECIFIC_BONUS = 0.1;
const PARENT_RATIO = 0.72;
const MIN_EXTRA_SCORE = 0.3;
const MIN_EXTRA_RATIO = 0.4;
const MIN_GLOVE_SIM = 0.22;
const CHILD_INJECT_SCORE = 0.26;
const RELATED_INJECT_SCORE = 0.26;

const CATEGORY_CHILDREN: Record<string, string[]> = {
  food: ["fruit", "vegetable", "drink"],
  object: ["clothing", "vehicle"],
  place: ["city_country"],
};

const RELATED_EXTRAS: Record<string, string[]> = {
  fruit: ["color"],
  vegetable: ["color"],
  food: ["animal"],
};

const PREVIEW_WORDS = [
  "กล้วย",
  "กุ้ง",
  "กระโปรง",
  "เสื้อ",
  "กรุงเทพ",
  "คลินิก",
  "ฝรั่ง",
  "ทับทิม",
  "ส้ม",
  "แดง",
  "ครู",
  "กิน",
  "กลัว",
  "กฎหมาย",
  "แมว",
  "น้ำ",
  "รถ",
  "ผัดไทย",
  "มือถือ",
  "โรงเรียน",
  "กาแฟ",
  "ช้าง",
  "ภูเขา",
  "หัวใจ",
  "เพลง",
  "คน",
  "บ้าน",
  "ยา",
  "กระเทียม",
];

const SPECIFIC_CATEGORIES = new Set([
  "fruit",
  "vegetable",
  "drink",
  "clothing",
  "vehicle",
  "city_country",
  "color",
  "health",
]);

const BROAD_CATEGORIES = new Set(["activity", "feeling", "abstract", "general"]);

const CATEGORY_PARENT: Record<string, string> = {
  fruit: "food",
  vegetable: "food",
  drink: "food",
  clothing: "object",
  vehicle: "object",
  city_country: "place",
};

const REDUNDANT_EXTRAS: Record<string, Set<string>> = {
  fruit: new Set(["nature", "abstract", "activity"]),
  vegetable: new Set(["nature", "abstract", "activity"]),
  food: new Set(["nature", "abstract", "activity"]),
  drink: new Set(["nature", "abstract", "activity"]),
  animal: new Set(["nature", "abstract", "activity"]),
  clothing: new Set(["abstract", "activity"]),
  vehicle: new Set(["abstract", "activity"]),
  city_country: new Set(["abstract", "activity"]),
  people: new Set(["abstract"]),
  object: new Set(["abstract", "activity"]),
  body: new Set(["abstract", "activity"]),
  color: new Set(["abstract", "activity"]),
  place: new Set(["abstract", "activity"]),
  health: new Set(["abstract", "activity"]),
};

const NOUN_LEX_CATEGORY: Record<number, string> = {
  3: "abstract",
  4: "activity",
  5: "animal",
  6: "object",
  7: "abstract",
  8: "body",
  9: "abstract",
  10: "abstract",
  11: "activity",
  12: "feeling",
  13: "food",
  14: "people",
  15: "place",
  16: "abstract",
  17: "nature",
  18: "people",
  19: "nature",
  20: "nature",
  21: "object",
  22: "abstract",
  23: "abstract",
  24: "abstract",
  25: "abstract",
  26: "abstract",
  27: "nature",
  28: "abstract",
};

type DatasetRow = {
  id?: number;
  word: string;
  category: string;
  categories?: string[];
  tier: number;
  source: string;
  synsets: string[] | null;
  core: number | boolean;
  length: number;
};

function datasetPath() {
  return path.join(pathsFor("th").root, "thai-contexto-70k.jsonl");
}

function wordNetDictPath() {
  return path.join(pathsFor("th").rawDir, "wordnet-3.0", "dict");
}

function parseSynsets(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    const ids = raw.filter((item): item is string => typeof item === "string" && Boolean(item));
    return ids.length ? ids : null;
  }
  if (typeof raw === "string" && raw.trim()) {
    const ids = raw.split("|").filter(Boolean);
    return ids.length ? ids : null;
  }
  return null;
}

function loadDataset(file: string): DatasetRow[] {
  const rows: DatasetRow[] = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const raw = JSON.parse(line.replace(/:\s*NaN\b/g, ": null")) as {
      id?: number;
      word?: string;
      category?: string;
      categories?: string[];
      tier?: number;
      source?: string;
      synsets?: unknown;
      core?: number | boolean;
      length?: number;
    };
    const word = (raw.word ?? "").trim();
    if (!word) continue;
    rows.push({
      id: raw.id,
      word,
      category: raw.category ?? "general",
      categories: Array.isArray(raw.categories) ? raw.categories : undefined,
      tier: raw.tier ?? 3,
      source: raw.source ?? "wordnet",
      synsets: parseSynsets(raw.synsets),
      core: raw.core ?? 0,
      length: raw.length ?? word.length,
    });
  }
  return rows;
}

function ensureWordNet30(): string {
  const dict = wordNetDictPath();
  if (fs.existsSync(path.join(dict, "data.noun"))) return dict;
  const root = path.dirname(dict);
  const tar = path.join(root, "WNdb-3.0.tar.gz");
  if (!fs.existsSync(tar)) {
    throw new Error(
      `Missing WordNet 3.0 at ${dict}. Download https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz into ${root}/`,
    );
  }
  fs.mkdirSync(root, { recursive: true });
  execFileSync("tar", ["-xzf", tar, "-C", root]);
  return dict;
}

function loadLexMap(dict: string): Map<string, number> {
  const map = new Map<string, number>();
  const load = (file: string, pos: string) => {
    for (const line of fs.readFileSync(path.join(dict, file), "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith(" ")) continue;
      const parts = (line.split(" | ")[0] ?? line).split(" ");
      const offset = parts[0];
      const lex = Number(parts[1]);
      if (!offset || !Number.isFinite(lex)) continue;
      map.set(`${offset}-${pos}`, lex);
      if (pos === "a") map.set(`${offset}-s`, lex);
    }
  };
  load("data.noun", "n");
  load("data.verb", "v");
  load("data.adj", "a");
  load("data.adv", "r");
  return map;
}

function synsetCategory(synsetId: string, lex: number): string {
  if (synsetId.endsWith("-v")) return "activity";
  if (synsetId.endsWith("-r")) return "abstract";
  if (synsetId.endsWith("-a") || synsetId.endsWith("-s")) return "abstract";
  return NOUN_LEX_CATEGORY[lex] ?? "abstract";
}

function synsetWeight(synsetId: string): number {
  if (synsetId.endsWith("-n")) return 1;
  if (synsetId.endsWith("-v")) return 0.7;
  return 0.3;
}

function wordNetVotes(synsets: string[] | null, lexMap: Map<string, number>): Map<string, number> {
  const votes = new Map<string, number>();
  if (!synsets) return votes;
  for (const id of synsets) {
    const lex = lexMap.get(id);
    if (lex == null) continue;
    const category = synsetCategory(id, lex);
    votes.set(category, (votes.get(category) ?? 0) + synsetWeight(id));
  }
  return votes;
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

function centroid(vectors: number[][]): number[] | null {
  if (vectors.length < 3) return null;
  const acc = new Array<number>(vectors[0].length).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < vector.length; i += 1) acc[i] += vector[i];
  }
  return l2normalize(acc);
}

function preferSpecific(categories: string[]): string[] {
  const set = new Set(categories);
  const used = new Set<string>();
  const result: string[] = [];
  const emit = (category: string) => {
    if (used.has(category) || !set.has(category)) return;
    used.add(category);
    result.push(category);
  };

  for (const category of categories) {
    if (used.has(category)) continue;
    const children = (CATEGORY_CHILDREN[category] ?? []).filter((child) => set.has(child));
    const parent = CATEGORY_PARENT[category];
    if (children.length) {
      for (const child of children) emit(child);
      emit(category);
      continue;
    }
    if (parent && set.has(parent)) {
      emit(category);
      emit(parent);
      continue;
    }
    emit(category);
  }
  return result;
}

export function tagRow(
  row: DatasetRow,
  votes: Map<string, number>,
  vector: number[] | undefined,
  centroids: Map<string, number[]>,
): { categories: string[]; scores: Record<string, number> } {
  const scores = new Map<string, number>();
  const add = (category: string, amount: number) => {
    if (!category || category === "general") return;
    scores.set(category, (scores.get(category) ?? 0) + amount);
  };

  const voteTotal = [...votes.values()].reduce((sum, value) => sum + value, 0);
  if (voteTotal > 0) {
    for (const [category, value] of votes) add(category, WN_WEIGHT * (value / voteTotal));
  }

  if (vector) {
    for (const [category, center] of centroids) {
      const sim = dot(vector, center);
      if (sim < MIN_GLOVE_SIM) continue;
      let amount = GLOVE_WEIGHT * sim;
      if (SPECIFIC_CATEGORIES.has(category)) amount += SPECIFIC_BONUS * sim;
      add(category, amount);
    }
  }

  if (row.source === "curated" && row.category && row.category !== "general") {
    add(row.category, GOLD_BONUS);
  }

  for (const [child, parent] of Object.entries(CATEGORY_PARENT)) {
    const childScore = scores.get(child);
    if (!childScore) continue;
    scores.set(parent, Math.max(scores.get(parent) ?? 0, childScore * PARENT_RATIO));
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const scoreObj = Object.fromEntries(ranked.map(([category, score]) => [category, Number(score.toFixed(4))]));
  if (ranked.length === 0) return { categories: ["general"], scores: scoreObj };

  const picked = [ranked[0][0]];
  const topScore = ranked[0][1];
  const redundant = REDUNDANT_EXTRAS[picked[0]] ?? new Set<string>();
  const children = CATEGORY_CHILDREN[picked[0]] ?? [];

  for (const [category, score] of ranked.slice(1)) {
    if (children.includes(category) && score >= CHILD_INJECT_SCORE) {
      picked.push(category);
      break;
    }
  }

  const related = RELATED_EXTRAS[picked[0]] ?? [];
  for (const [category, score] of ranked.slice(1)) {
    if (related.includes(category) && score >= RELATED_INJECT_SCORE && picked.length < MAX_TAGS) {
      picked.push(category);
      break;
    }
  }

  const parent = CATEGORY_PARENT[picked[0]];
  const hasRelatedExtra = related.some((category) => picked.includes(category));
  if (hasRelatedExtra && parent) redundant.add(parent);

  for (const [category, score] of ranked.slice(1)) {
    if (picked.length >= MAX_TAGS) break;
    if (picked.includes(category) || redundant.has(category)) continue;
    if (score < MIN_EXTRA_SCORE || score < topScore * MIN_EXTRA_RATIO) continue;
    if (BROAD_CATEGORIES.has(category) && picked.some((item) => !BROAD_CATEGORIES.has(item)) && score < 0.38) {
      continue;
    }
    picked.push(category);
  }

  if (parent && !picked.includes(parent) && picked.length < MAX_TAGS && !hasRelatedExtra) {
    picked.push(parent);
  }

  return { categories: preferSpecific(picked).slice(0, MAX_TAGS), scores: scoreObj };
}

async function main() {
  const file = datasetPath();
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}. Run npm run build-vocab:th first.`);
  }

  console.log("Loading dataset + WordNet 3.0 + Thai GloVe...");
  const rows = loadDataset(file);
  const lexMap = loadLexMap(ensureWordNet30());
  const vectors = await loadThaiGloveVectors(new Set(rows.map((row) => row.word)));

  const byCategory = new Map<string, number[][]>();
  for (const row of rows) {
    if (row.source !== "curated" || row.category === "general") continue;
    const vector = vectors.get(row.word);
    if (!vector) continue;
    const list = byCategory.get(row.category) ?? [];
    list.push(vector);
    byCategory.set(row.category, list);
  }

  const centroids = new Map<string, number[]>();
  for (const [category, list] of byCategory) {
    const center = centroid(list);
    if (center) centroids.set(category, center);
  }

  const tagged: Array<{ row: DatasetRow; categories: string[]; scores: Record<string, number> }> = [];
  const tagCounts = [0, 0, 0, 0];
  const primaryCounts = new Map<string, number>();

  for (const row of rows) {
    const { categories, scores } = tagRow(row, wordNetVotes(row.synsets, lexMap), vectors.get(row.word), centroids);
    tagged.push({ row, categories, scores });
    tagCounts[categories.length] += 1;
    primaryCounts.set(categories[0], (primaryCounts.get(categories[0]) ?? 0) + 1);
  }

  console.log("GloVe overlap:", vectors.size);
  console.log("Centroids:", [...centroids.keys()].sort().join(", "));
  console.log("Tag counts:", { 1: tagCounts[1], 2: tagCounts[2], 3: tagCounts[3] });
  console.log(
    "Primary categories:",
    Object.fromEntries([...primaryCounts.entries()].sort((a, b) => b[1] - a[1])),
  );
  console.log("\nPreview:");
  const byWord = new Map(tagged.map((item) => [item.row.word, item]));
  for (const word of PREVIEW_WORDS) {
    const item = byWord.get(word);
    if (!item) {
      console.log(`  ${word}: MISSING`);
      continue;
    }
    const top = Object.entries(item.scores)
      .slice(0, 5)
      .map(([category, score]) => `${category}=${score}`)
      .join(" ");
    console.log(`  ${word.padEnd(12)} ${item.categories.join(" > ")}   (${top})`);
  }

  if (process.argv.includes("--dry-run")) {
    console.log("\nDry run: dataset not written.");
    return;
  }

  const out = tagged
    .map(({ row, categories }) =>
      JSON.stringify({
        id: row.id,
        word: row.word,
        category: categories[0],
        categories,
        tier: row.tier,
        source: row.source,
        synsets: row.synsets ? row.synsets.join("|") : null,
        core: row.core,
        length: row.length,
      }),
    )
    .join("\n");
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${out}\n`);
  fs.renameSync(tmp, file);
  console.log(`\nWrote ${tagged.length} rows → ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
