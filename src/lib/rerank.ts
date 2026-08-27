import OpenAI from "openai";
import {
  categoriesFor,
  categoryDisplayName,
  clusterBoost,
  isCategoryLabel,
  loadWordSenses,
} from "./categories";
import { englishNamesFor } from "./clue-traits";
import type { GameLang } from "./lang";

const RERANK_POOL = 120;
const GROQ_TIMEOUT_MS = 20_000;

function hasGroq(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

function groqModel(): string {
  return process.env.GROQ_HINT_MODEL ?? "openai/gpt-oss-120b";
}

function extractJson(raw: string): { close?: unknown; far?: unknown } | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as { close?: unknown; far?: unknown };
  } catch {
    return null;
  }
}

function relatedStem(secret: string, word: string): boolean {
  if (secret.length < 2 || word.length < 2) return false;
  return word.includes(secret) || secret.includes(word);
}

function mustKeep(secret: string, lang: GameLang, word: string): boolean {
  if (relatedStem(secret, word)) return true;
  if (clusterBoost(secret, word) > 0) return true;
  const cats = categoriesFor(secret, lang);
  return isCategoryLabel(word, cats);
}

function asWordList(value: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const word of value) {
    if (typeof word !== "string" || !allowed.has(word) || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }
  return out;
}

type RerankBuckets = { close: string[]; far: string[] };

async function groqRerankBuckets(
  secret: string,
  lang: GameLang,
  pool: string[],
): Promise<RerankBuckets | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const model = groqModel();
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
    timeout: GROQ_TIMEOUT_MS,
  });
  const cats = categoriesFor(secret, lang);
  const gloss = englishNamesFor(secret)[0];
  const category =
    cats.map((item) => categoryDisplayName(item, lang)).join(", ") || "unknown";
  const allowed = new Set(pool);
  const started = Date.now();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You rerank neighbors for a semantic word game. Return only JSON {"close":["..."],"far":["..."]}.',
          },
          {
            role: "user",
            content: [
              `Secret: ${secret}`,
              gloss ? `Meaning: ${gloss}` : "",
              `Language: ${lang === "th" ? "Thai" : "English"}`,
              `Category: ${category}`,
              "An embedding model ranked these as close. Same category is not enough.",
              "close = the nearest in meaning, closest first, at most 12 words.",
              "Examples: gray → black/white, not green. Congee → rice porridge, not ketchup.",
              "far = wrong sense or unrelated. Omit ordinary same-category words from both lists.",
              `Candidates: ${JSON.stringify(pool)}`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        reasoning_effort: "low",
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
      const message = response.choices[0]?.message as {
        content?: string | null;
        reasoning?: string;
      };
      const raw = message?.content?.trim() || message?.reasoning || "";
      const parsed = extractJson(raw);
      const close = asWordList(parsed?.close, allowed);
      const far = asWordList(parsed?.far, allowed).filter((word) => !close.includes(word));
      console.info(
        `[rank] groq buckets close=${close.length} far=${far.length} in ${Date.now() - started}ms`,
      );
      if (!close.length && !far.length) return null;
      return { close, far };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const wait = message.match(/try again in ([\d.]+)\s*s/i);
      if (message.includes("429") && attempt < 3) {
        const delay = wait ? Math.ceil(Number(wait[1]) * 1000) + 250 : 1500 * attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      console.warn(`[rank] groq rerank failed in ${Date.now() - started}ms:`, message);
      return null;
    }
  }
  return null;
}

function applyBuckets(
  secret: string,
  lang: GameLang,
  pool: string[],
  buckets: RerankBuckets,
): string[] {
  const seen = new Set<string>();
  const top: string[] = [];
  for (const word of buckets.close) {
    if (seen.has(word)) continue;
    seen.add(word);
    top.push(word);
  }

  const far = new Set<string>();
  for (const word of buckets.far) {
    if (seen.has(word) || mustKeep(secret, lang, word)) continue;
    far.add(word);
  }

  const mid: string[] = [];
  const bottom: string[] = [];
  for (const word of pool) {
    if (seen.has(word)) continue;
    if (far.has(word)) bottom.push(word);
    else mid.push(word);
  }
  return [...top, ...mid, ...bottom];
}

/** Reorder the embedding top so nearest meanings rise and false neighbors fall. */
export async function rerankTopWords(
  secret: string,
  lang: GameLang,
  words: string[],
): Promise<string[]> {
  if (lang !== "th" || words.length === 0 || !hasGroq()) return words;

  const pool = words.slice(0, RERANK_POOL);
  const rest = words.slice(RERANK_POOL);
  const started = Date.now();
  const buckets = await groqRerankBuckets(secret, lang, pool);
  if (!buckets) return words;

  const ordered = applyBuckets(secret, lang, pool, buckets);
  const senses = loadWordSenses(lang);
  console.info(
    `[rank] groq rerank ${secret} (${senses.get(secret)?.categories.join(",") || "?"}) in ${Date.now() - started}ms`,
  );
  return [...ordered, ...rest];
}
