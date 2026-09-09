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
import { llmClient, llmModel, llmProvider, throwIfRateLimited, withProviderParams } from "./llm";
import { loadRerankBuckets } from "./prepared";
import type { RerankBuckets } from "./types";

export const RERANK_POOL = 120;
const BUCKET_LIMIT = 12;
const RERANK_MAX_TOKENS = 1600;

function hasLlmRerank(): boolean {
  return Boolean(llmClient());
}

function groqErrorMessage(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    const body = error.error as { failed_generation?: string } | undefined;
    const failed = body?.failed_generation?.replace(/\s+/g, " ").slice(0, 240);
    return failed ? `${error.message} | failed_generation=${failed}` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export async function groqRerankBuckets(
  secret: string,
  lang: GameLang,
  pool: string[],
): Promise<RerankBuckets | null> {
  const client = llmClient();
  if (!client) return null;

  const model = llmModel();
  const provider = llmProvider() ?? "llm";
  const cats = categoriesFor(secret, lang);
  const gloss = englishNamesFor(secret)[0];
  const category =
    cats.map((item) => categoryDisplayName(item, lang)).join(", ") || "unknown";
  const allowed = new Set(pool);
  const started = Date.now();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const jsonMode = attempt === 1;
    try {
      const response = await client.chat.completions.create(
        withProviderParams({
          model,
          temperature: 0,
          max_tokens: RERANK_MAX_TOKENS,
          ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
          messages: [
            {
              role: "system",
              content:
                'You rerank neighbors for a semantic word game. Return only JSON {"close":["..."],"far":["..."]}. Each array has at most 12 words.',
            },
            {
              role: "user",
              content: [
                `Secret: ${secret}`,
                gloss ? `Meaning: ${gloss}` : "",
                `Language: ${lang === "th" ? "Thai" : "English"}`,
                `Category: ${category}`,
                "An embedding model ranked these as close. Same category is not enough.",
                `close = the nearest in meaning, closest first, at most ${BUCKET_LIMIT} words.`,
                "Examples: gray → black/white, not green. Congee → rice porridge, not ketchup.",
                `far = wrong sense or unrelated, at most ${BUCKET_LIMIT} words. Do not dump the candidate list.`,
                "Omit ordinary same-category words from both lists.",
                `Candidates: ${JSON.stringify(pool)}`,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        }) as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      );
      const message = response.choices[0]?.message as {
        content?: string | null;
        reasoning?: string;
      };
      const raw = message?.content?.trim() || message?.reasoning || "";
      const parsed = extractJson(raw);
      const close = asWordList(parsed?.close, allowed).slice(0, BUCKET_LIMIT);
      const far = asWordList(parsed?.far, allowed)
        .filter((word) => !close.includes(word))
        .slice(0, BUCKET_LIMIT);
      console.info(
        `[rank] ${provider} buckets close=${close.length} far=${far.length} in ${Date.now() - started}ms`,
      );
      if (!close.length && !far.length) {
        if (attempt < 3) continue;
        return null;
      }
      return { close, far };
    } catch (error) {
      throwIfRateLimited(error);
      console.warn(
        `[rank] ${provider} rerank failed (attempt ${attempt}) in ${Date.now() - started}ms:`,
        groqErrorMessage(error),
      );
      if (attempt === 3) return null;
      await sleep(400 * attempt);
    }
  }
  return null;
}

export function applyBuckets(
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
  options?: { groq?: boolean },
): Promise<string[]> {
  if (lang !== "th" || words.length === 0) return words;

  const pool = words.slice(0, RERANK_POOL);
  const rest = words.slice(RERANK_POOL);
  const prepared = loadRerankBuckets(secret, lang);
  if (prepared) {
    return [...applyBuckets(secret, lang, pool, prepared), ...rest];
  }

  if (!options?.groq || !hasLlmRerank()) return words;

  const started = Date.now();
  const buckets = await groqRerankBuckets(secret, lang, pool);
  if (!buckets) return words;

  const ordered = applyBuckets(secret, lang, pool, buckets);
  const senses = loadWordSenses(lang);
  console.info(
    `[rank] ${llmProvider() ?? "llm"} rerank ${secret} (${senses.get(secret)?.categories.join(",") || "?"}) in ${Date.now() - started}ms`,
  );
  return [...ordered, ...rest];
}
