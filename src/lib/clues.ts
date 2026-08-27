import OpenAI from "openai";
import { categoriesFor, categoryDisplayName } from "./categories";
import {
  animalKindFor,
  englishNamesFor,
  fruitFactsFor,
  glossFactError,
  hintFactError,
  hintFactRejectMessage,
  promptGuardFor,
  specificHints,
} from "./clue-traits";
import { hintMatchesLang, type GameLang } from "./lang";
import { GameError, MAX_HINTS } from "./types";

const GROQ_TIMEOUT_MS = 8_000;

function fold(text: string): string {
  return text.trim().toLowerCase().replace(/[\s\-่้๊๋็์ฺ]/g, "");
}

function containsTerm(clue: string, term: string): boolean {
  const hay = fold(clue);
  const needle = fold(term);
  if (needle.length < 2 || hay.length < 2) return false;
  return hay === needle || hay.includes(needle) || needle.includes(hay);
}

function clueConflicts(clue: string, blocked: string[]): boolean {
  return blocked.some((term) => containsTerm(clue, term));
}

function uniqueList(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    const key = fold(trimmed);
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function nearbyGuessWords(
  guessed: string[],
  ranks: Map<string, number>,
  nearest = 8,
  recent = 3,
): { word: string; rank: number }[] {
  const withRank = guessed
    .map((word) => ({ word, rank: ranks.get(word) ?? Number.POSITIVE_INFINITY }))
    .filter((item) => Number.isFinite(item.rank));
  const closest = [...withRank].sort((a, b) => a.rank - b.rank).slice(0, nearest);
  const latest = guessed.slice(-recent);
  const seen = new Set<string>();
  const out: { word: string; rank: number }[] = [];
  for (const word of [...closest.map((item) => item.word), ...latest]) {
    if (seen.has(word)) continue;
    seen.add(word);
    out.push({ word, rank: ranks.get(word) ?? Number.POSITIVE_INFINITY });
  }
  return out;
}

function parseAiHintPack(
  raw: string,
  secret: string,
  blocked: string[],
  lang: GameLang,
): { hints: string[]; factError?: string } | { error: string } {
  const cats = categoriesFor(secret, lang);
  const tryParse = (
    text: string,
  ): { hints: string[]; factError?: string } | { error: string } => {
    try {
      const parsed = JSON.parse(text) as { hints?: unknown; meaning?: unknown };
      if (typeof parsed.meaning === "string" && parsed.meaning.trim()) {
        const meaning = parsed.meaning.trim();
        console.info(`[hints] model gloss: ${meaning}`);
        const glossError = glossFactError(secret, meaning, cats);
        if (glossError) return { error: glossError };
      }
      if (!Array.isArray(parsed.hints)) return { error: "missing hints array" };
      const hints = parsed.hints
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item === "object" && "text" in item) {
            const textValue = (item as { text?: unknown }).text;
            return typeof textValue === "string" ? textValue.trim() : "";
          }
          return "";
        })
        .filter(Boolean)
        .map((hint) => (hint.length > 28 ? hint.slice(0, 28).trim() : hint));
      if (hints.length < MAX_HINTS) return { error: "fewer than 3 hints" };
      const cleaned: string[] = [];
      for (const hint of hints) {
        if (cleaned.length >= MAX_HINTS) break;
        if (!hint || hint.length < 2) continue;
        if (containsTerm(hint, secret)) continue;
        if (!hintMatchesLang(hint, lang)) continue;
        if (clueConflicts(hint, [...blocked, ...cleaned])) continue;
        cleaned.push(hint);
      }
      if (cleaned.length < MAX_HINTS) {
        return {
          error:
            lang === "en"
              ? "hints must be English, not Thai"
              : "a hint named the secret, used English, or repeated a guess",
        };
      }
      const factError = lang === "th" ? hintFactError(secret, cleaned, cats) : null;
      if (factError) {
        console.warn(`[hints] fact-check: ${factError} rejected for ${secret}`);
        return { hints: cleaned, factError: hintFactRejectMessage(factError, cleaned) };
      }
      return { hints: cleaned };
    } catch {
      return { error: "invalid JSON" };
    }
  };

  const direct = tryParse(raw.trim());
  if ("hints" in direct) return direct;
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? tryParse(match[0]) : direct;
}

function buildAnchorFacts(secret: string, lang: GameLang): string {
  const cats = categoriesFor(secret, lang);
  const primary = cats[0];
  const specific = specificHints(secret, lang, primary);
  const lines: string[] = [];
  if (cats.length) {
    lines.push(
      `Category anchor: ${cats.map((cat) => categoryDisplayName(cat, lang)).join(", ")}`,
    );
  }
  if (specific) {
    const facts = uniqueList([...specific.groups, ...specific.traits]);
    if (facts.length) {
      lines.push(`Known true facts (hints must match these, never contradict): ${facts.join("; ")}`);
    }
  }
  return lines.join("\n");
}

function buildCluePackPrompt(options: {
  secret: string;
  lang: GameLang;
  nearby: { word: string; rank: number }[];
  rejectReason?: string;
}): string {
  const cats = categoriesFor(options.secret, options.lang);
  const categoryLine = cats.length
    ? cats.map((cat) => categoryDisplayName(cat, options.lang)).join(", ")
    : options.lang === "th"
      ? "ไม่ทราบหมวด"
      : "unknown";
  const closest = [...options.nearby].sort((a, b) => a.rank - b.rank)[0];
  const nearbyLine = options.nearby.length
    ? options.nearby
        .map((item) =>
          Number.isFinite(item.rank) ? `${item.word} (#${item.rank})` : item.word,
        )
        .join(", ")
    : options.lang === "th"
      ? "ยังไม่มี"
      : "none yet";
  const language = options.lang === "th" ? "Thai" : "English";
  const languageRules =
    options.lang === "th"
      ? "Write ALL hints in Thai script only. No English letters. Each hint under 16 Thai characters."
      : "Write ALL hints in English only. No Thai script or other languages. Each hint under 6 English words.";
  const anchor = buildAnchorFacts(options.secret, options.lang);
  const names = englishNamesFor(options.secret);
  const nameLine = names.length
    ? `English name of THIS secret: ${names.join(" / ")}. If you name a different species, the answer is wrong.`
    : "";
  const fruit = fruitFactsFor(options.secret);
  const animal = animalKindFor(options.secret);
  const identityLine = fruit
    ? `True fruit facts for THIS word only: flesh=${fruit.flesh.join("/")}, seeds=${fruit.seed}, peel=${fruit.peel}.`
    : animal
      ? `This secret is a ${animal}. Do not describe a different animal class.`
      : "";
  const guard = options.lang === "th" ? promptGuardFor(options.secret, cats) : "";
  const steer =
    closest && closest.rank <= 80
      ? `The player guessed ${closest.word} (#${closest.rank}). Do NOT describe that guess. Give traits true of the secret that distinguish it from ${closest.word}.`
      : "Each hint must narrow toward the secret, not restate a broad category.";

  return [
    `Identify this ${language} word first, then write 3 progressive Contexto hints in ${language}.`,
    `Hint language: ${language} only. Secret (never say/spell/translate it in hints): ${options.secret}`,
    languageRules,
    "If the spelling has several senses, pick the sense matching the given category.",
    anchor || "Use accurate world knowledge for this exact spelling.",
    nameLine,
    identityLine,
    guard,
    `Categories: ${categoryLine}`,
    `Guesses: ${nearbyLine}`,
    steer,
    "Every hint must be factually true of THIS secret only. False colors, seeds, shells, legs, wings, or venom are forbidden.",
    "Do not copy traits from a similar fruit, animal, dish, or nearby guess.",
    "Never write another dish or species name as a hint. Describe THIS spelling only.",
    "Hint 1 broad true property. Hint 2 true subtype. Hint 3 distinctive true trait, still unnamed.",
    "No guessed words. No empty labels.",
    options.rejectReason ? `REJECTED LAST ATTEMPT: ${options.rejectReason}` : "",
    'Return ONLY JSON {"meaning":"english gloss of THIS word","hints":["...","...","...","..."]} with 4 true candidates.',
  ].filter(Boolean).join("\n");
}

type HintGenOptions = {
  secret: string;
  lang: GameLang;
  nearby: { word: string; rank: number }[];
  blocked: string[];
  rejectReason?: string;
};

export function hasGroqHints(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

function groqClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
    timeout: GROQ_TIMEOUT_MS,
  });
}

function groqModel(): string {
  return process.env.GROQ_HINT_MODEL ?? "openai/gpt-oss-120b";
}

async function groqComplete(
  client: OpenAI,
  model: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  temperature = 0.2,
): Promise<string | null> {
  const response = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: 400,
    messages,
    reasoning_effort: "low",
  } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
  const message = response.choices[0]?.message as {
    content?: string | null;
    reasoning?: string;
  };
  const content = message?.content?.trim();
  if (content) return content;
  const reasoned = message?.reasoning?.match(/\{[\s\S]*\}/);
  return reasoned?.[0] ?? null;
}

async function auditCluePackWithGroq(
  client: OpenAI,
  model: string,
  options: HintGenOptions,
  hints: string[],
  why: string,
): Promise<string[] | null> {
  const cats = categoriesFor(options.secret, options.lang);
  const started = Date.now();
  try {
    const raw = await groqComplete(client, model, [
      {
        role: "system",
        content:
          `You fact-check ${options.lang === "th" ? "Thai" : "English"} word-game hints. Return only JSON in that same language. Never name the secret in hints.`,
      },
      {
        role: "user",
        content: [
          `Secret word: ${options.secret}`,
          `Language: ${options.lang === "th" ? "Thai" : "English"}`,
          `Categories: ${cats.join(", ") || "unknown"}`,
          promptGuardFor(options.secret, cats),
          `These hints failed a fact-check: ${JSON.stringify(hints)}`,
          `Reason: ${why}`,
          "Write 3 corrected hints that are factually true of THIS exact spelling — not a similar word.",
          'Return {"ok":false,"why":"short reason","hints":["true1","true2","true3"]}.',
          options.lang === "th"
            ? "Corrected hints must be Thai script only, under 16 characters. No English."
            : "Corrected hints must be English only, under 6 words. No Thai script.",
          "Do not use the secret or a translation of it.",
        ].filter(Boolean).join("\n"),
      },
    ]);
    if (!raw) return null;
    const parsed = parseAiHintPack(raw, options.secret, options.blocked, options.lang);
    if ("error" in parsed) {
      console.info(`[hints] groq audit failed in ${Date.now() - started}ms: ${parsed.error}`);
      return null;
    }
    if (parsed.factError) {
      console.info(`[hints] groq audit still false in ${Date.now() - started}ms: ${parsed.factError}`);
      return null;
    }
    console.info(`[hints] groq audit ok in ${Date.now() - started}ms`);
    return parsed.hints;
  } catch (error) {
    console.warn(
      `[hints] groq audit error in ${Date.now() - started}ms:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

const RETRY_TEMPERATURE = [0.2, 0.4, 0.55, 0.7];

async function generateCluePackWithGroq(options: HintGenOptions): Promise<string[] | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const model = groqModel();
  const client = groqClient(apiKey);
  const language = options.lang === "th" ? "Thai" : "English";

  let rejectReason = options.rejectReason;
  for (let attempt = 1; attempt <= RETRY_TEMPERATURE.length; attempt += 1) {
    const started = Date.now();
    const temperature = RETRY_TEMPERATURE[attempt - 1] ?? 0.5;
    try {
      const raw = await groqComplete(
        client,
        model,
        [
          {
            role: "system",
            content:
              `Identify the exact ${language} spelling, not a similar-looking word. Return only JSON with keys meaning and hints. Hints must be in ${language} only. Never put the secret in a hint. False physical traits are forbidden.`,
          },
          {
            role: "user",
            content: buildCluePackPrompt({ ...options, rejectReason }),
          },
        ],
        temperature,
      );
      const parsed = raw
        ? parseAiHintPack(raw, options.secret, options.blocked, options.lang)
        : { error: "empty response" };
      if ("error" in parsed) {
        rejectReason = parsed.error;
        console.info(
          `[hints] groq ${model} attempt ${attempt} failed in ${Date.now() - started}ms: ${parsed.error}`,
        );
        continue;
      }

      if (!parsed.factError) {
        console.info(`[hints] groq ${model} ok in ${Date.now() - started}ms`);
        return parsed.hints;
      }

      const audited = await auditCluePackWithGroq(
        client,
        model,
        options,
        parsed.hints,
        parsed.factError,
      );
      if (audited) {
        console.info(`[hints] groq ${model} repaired in ${Date.now() - started}ms`);
        return audited;
      }
      rejectReason = parsed.factError;
      console.info(`[hints] groq ${model} attempt ${attempt} failed local check`);
    } catch (error) {
      console.warn(
        `[hints] groq attempt ${attempt} failed in ${Date.now() - started}ms:`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }
  return null;
}

export type CluePackSource = "ai";

export async function nextCluePack(options: {
  secret: string;
  lang: GameLang;
  guessed?: string[];
  ranks?: Map<string, number>;
}): Promise<{ clues: string[]; planned: string[]; source: CluePackSource }> {
  const guessed = options.guessed ?? [];
  const ranks = options.ranks ?? new Map<string, number>();
  const nearby = nearbyGuessWords(guessed, ranks);
  const blocked = uniqueList([options.secret, ...guessed]);
  const started = Date.now();

  const packOptions = {
    secret: options.secret,
    lang: options.lang,
    nearby,
    blocked,
  };
  const planned = await generateCluePackWithGroq(packOptions);

  if (planned && planned.length >= MAX_HINTS) {
    const uniquePlanned = uniqueList(planned).slice(0, MAX_HINTS);
    if (uniquePlanned.length >= MAX_HINTS) {
      console.info(`[hints] using ai pack in ${Date.now() - started}ms`);
      return { clues: [uniquePlanned[0]], planned: uniquePlanned, source: "ai" };
    }
  }

  throw new GameError(
    "hint_unavailable",
    options.lang === "th"
      ? "ยังเตรียมคำใบ้ไม่ได้ ใส่ GROQ_API_KEY ใน .env แล้วรีสตาร์ทเซิร์ฟเวอร์"
      : "Hints unavailable. Add GROQ_API_KEY to .env and restart the server.",
    503,
  );
}
