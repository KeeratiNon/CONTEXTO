import fs from "node:fs";
import { pathsFor } from "./paths";
import type { GameLang } from "./lang";

export const CATEGORY_BOOST = 0.4;
export const BROAD_CATEGORY_BOOST = 0.02;
export const HYPERNYM_BOOST = 0.12;
export const SYNSET_BOOST = 0.3;

export const SPECIFIC_CATEGORIES = new Set([
  "food",
  "fruit",
  "vegetable",
  "drink",
  "animal",
  "clothing",
  "vehicle",
  "city_country",
  "color",
  "health",
  "body",
]);

const CATEGORY_PARENT: Record<string, string> = {
  fruit: "food",
  vegetable: "food",
  drink: "food",
  clothing: "object",
  vehicle: "object",
  city_country: "place",
};

const CATEGORY_LABELS: Record<string, string[]> = {
  fruit: ["ผลไม้"],
  vegetable: ["ผัก"],
  food: ["อาหาร", "กับข้าว", "ของกิน"],
  drink: ["เครื่องดื่ม"],
  animal: ["สัตว์"],
  people: ["คน", "มนุษย์", "บุคคล"],
  place: ["สถานที่"],
  object: ["สิ่งของ"],
  clothing: ["เสื้อผ้า"],
  vehicle: ["ยานพาหนะ"],
  nature: ["ธรรมชาติ"],
  body: ["ร่างกาย"],
  health: ["สุขภาพ"],
  color: ["สี"],
  activity: ["กิจกรรม"],
  feeling: ["ความรู้สึก", "อารมณ์"],
  city_country: ["ประเทศ", "เมือง"],
};

const LABEL_CATEGORIES = new Map<string, Set<string>>();
for (const [category, labels] of Object.entries(CATEGORY_LABELS)) {
  for (const label of labels) {
    const current = LABEL_CATEGORIES.get(label) ?? new Set<string>();
    current.add(category);
    LABEL_CATEGORIES.set(label, current);
  }
}

export type WordSense = {
  categories: string[];
  synsets: string[];
};

const globalForSenses = globalThis as unknown as {
  __contextoSenses?: Map<string, WordSense>;
  __contextoCategories?: Map<string, string[]>;
};

function parseCategories(raw: unknown, fallback?: string): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string" && Boolean(item));
  }
  return fallback ? [fallback] : [];
}

function parseSynsets(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string" && Boolean(item));
  if (typeof raw === "string" && raw.trim()) return raw.split("|").filter(Boolean);
  return [];
}

function loadThaiSenses(): Map<string, WordSense> {
  if (globalForSenses.__contextoSenses) return globalForSenses.__contextoSenses;

  const map = new Map<string, WordSense>();
  const file = pathsFor("th").categoriesPath;
  if (!fs.existsSync(file)) {
    globalForSenses.__contextoSenses = map;
    return map;
  }

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const raw = JSON.parse(line.replace(/:\s*NaN\b/g, ": null")) as {
      word?: string;
      category?: string;
      categories?: unknown;
      synsets?: unknown;
    };
    const word = raw.word?.trim();
    if (!word) continue;
    const categories = parseCategories(raw.categories, raw.category);
    const synsets = parseSynsets(raw.synsets);
    if (categories.length || synsets.length) map.set(word, { categories, synsets });
  }

  globalForSenses.__contextoSenses = map;
  return map;
}

export function loadWordSenses(lang: GameLang): Map<string, WordSense> {
  if (lang !== "th") return new Map();
  return loadThaiSenses();
}

export function loadWordCategories(lang: GameLang): Map<string, string[]> {
  if (lang !== "th") return new Map();
  if (globalForSenses.__contextoCategories) return globalForSenses.__contextoCategories;
  const senses = loadWordSenses(lang);
  const map = new Map<string, string[]>();
  for (const [word, sense] of senses) {
    if (sense.categories.length) map.set(word, sense.categories);
  }
  globalForSenses.__contextoCategories = map;
  return map;
}

export function categoriesFor(
  word: string,
  lang: GameLang,
  table?: Map<string, string[]>,
): string[] {
  return (table ?? loadWordCategories(lang)).get(word) ?? [];
}

const CATEGORY_NAME_EN: Record<string, string> = {
  fruit: "fruit",
  vegetable: "vegetable",
  food: "food",
  drink: "drink",
  animal: "animal",
  people: "person",
  place: "place",
  object: "object",
  clothing: "clothing",
  vehicle: "vehicle",
  nature: "nature",
  body: "body part",
  health: "health",
  color: "color",
  activity: "activity",
  feeling: "feeling",
  city_country: "city or country",
  abstract: "abstract idea",
};

export function categoryDisplayName(category: string, lang: GameLang): string {
  if (lang === "th") return CATEGORY_LABELS[category]?.[0] ?? category;
  return CATEGORY_NAME_EN[category] ?? category.replaceAll("_", " ");
}

export function isSpecificCategory(category: string | undefined): boolean {
  return Boolean(category && SPECIFIC_CATEGORIES.has(category));
}

export function categoryOverlap(secretCats: string[], wordCats: string[]): number {
  if (secretCats.length === 0 || wordCats.length === 0) return 0;

  const secretPrimary = secretCats[0];
  const wordPrimary = wordCats[0];
  if (secretPrimary === wordPrimary) return 1;

  if (secretCats.includes(wordPrimary) || wordCats.includes(secretPrimary)) return 0.3;

  const secretParent = CATEGORY_PARENT[secretPrimary];
  const wordParent = CATEGORY_PARENT[wordPrimary];
  if (secretParent && secretParent === wordPrimary) return 0.2;
  if (wordParent && wordParent === secretPrimary) return 0.2;
  if (secretParent && wordParent && secretParent === wordParent) return 0.15;

  const secretSet = new Set(secretCats);
  if (wordCats.some((category) => secretSet.has(category))) return 0.25;
  return 0;
}

export function synsetOverlap(secretSynsets: string[], wordSynsets: string[]): number {
  const secretNouns = secretSynsets.filter((id) => id.endsWith("-n"));
  const wordNouns = wordSynsets.filter((id) => id.endsWith("-n"));
  if (!secretNouns.length || !wordNouns.length) return 0;
  const wanted = new Set(wordNouns);
  let shared = 0;
  for (const id of secretNouns) {
    if (wanted.has(id)) shared += 1;
  }
  if (!shared) return 0;
  return shared / (secretNouns.length + wordNouns.length - shared);
}

export function isCategoryLabel(word: string, secretCats: string[]): boolean {
  const named = LABEL_CATEGORIES.get(word);
  if (!named || !secretCats.length) return false;
  return named.has(secretCats[0]);
}

export function sharesPrimaryCategory(secretCats: string[], wordCats: string[]): boolean {
  return Boolean(secretCats[0] && wordCats[0] && secretCats[0] === wordCats[0]);
}

export function sharesAnyCategory(secretCats: string[], wordCats: string[]): boolean {
  if (!secretCats.length || !wordCats.length) return false;
  const wanted = new Set(secretCats);
  for (const category of secretCats) {
    const parent = CATEGORY_PARENT[category];
    if (parent) wanted.add(parent);
  }
  return wordCats.some(
    (category) =>
      wanted.has(category) || Boolean(CATEGORY_PARENT[category] && wanted.has(CATEGORY_PARENT[category])),
  );
}

export function relatednessScore(secret: WordSense, word: string, other: WordSense): number {
  const overlap = categoryOverlap(secret.categories, other.categories);
  const specific = isSpecificCategory(secret.categories[0]);
  const categoryBoost = (specific ? CATEGORY_BOOST : BROAD_CATEGORY_BOOST) * overlap;
  const hypernym = isCategoryLabel(word, secret.categories)
    ? specific
      ? HYPERNYM_BOOST
      : BROAD_CATEGORY_BOOST
    : 0;
  return categoryBoost + hypernym + SYNSET_BOOST * synsetOverlap(secret.synsets, other.synsets);
}
