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
import { hasLlm, llmClient, llmModel, llmProvider, throwIfRateLimited, withProviderParams } from "./llm";
import { isCompleteHintPack } from "./prepared";
import {
  HINT_LEVELS,
  HINTS_PER_LEVEL,
  type HintLevels,
  type HintPack,
} from "./types";

function fold(text: string): string {
  return text.trim().toLowerCase().replace(/[\s\-่้๊๋็์ฺ]/g, "");
}

function hintText(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object" && "text" in item) {
    const textValue = (item as { text?: unknown }).text;
    return typeof textValue === "string" ? textValue.trim() : "";
  }
  return "";
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

function containsTerm(clue: string, term: string): boolean {
  const hay = fold(clue);
  const needle = fold(term);
  if (needle.length < 2 || hay.length < 2) return false;
  if (hay === needle) return true;
  if (needle.length <= 2) return false;
  return hay.includes(needle);
}

function clueConflicts(clue: string, blocked: string[]): boolean {
  return blocked.some((term) => containsTerm(clue, term));
}

function namesSecret(clue: string, secret: string): boolean {
  const clueN = clue.trim().normalize("NFC");
  const secretN = secret.trim().normalize("NFC");
  if (!secretN) return false;
  if (fold(clueN) === fold(secretN)) return true;
  // อา inside อาหาร is fine; เท้า inside มีเท้า is a leak.
  if (secretN.length <= 2 && fold(secretN).length <= 2) return false;
  return clueN.includes(secretN);
}

function scrubHint(hint: string, lang: GameLang): string {
  if (lang !== "th") return hint;
  return hint
    .replace(/[A-Za-z]{2,}/g, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSecretFromHint(hint: string, secret: string): string {
  const secretN = secret.trim().normalize("NFC");
  if (secretN.length <= 2) return hint;
  if (!hint.includes(secretN)) return hint;
  return hint.split(secretN).join(" ").replace(/\s+/g, " ").trim();
}

function takeHints(items: unknown, secret: string, blocked: string[], lang: GameLang, limit: number): string[] {
  const guessed = blocked.filter((word) => fold(word) !== fold(secret));
  const hints = (Array.isArray(items) ? items : [])
    .map(hintText)
    .filter(Boolean)
    .map((hint) => scrubHint(hint, lang))
    .map((hint) => stripSecretFromHint(hint, secret))
    .map((hint) => (hint.length > 28 ? hint.slice(0, 28).trim() : hint));
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const hint of hints) {
    if (cleaned.length >= limit) break;
    if (!hint || hint.length < 2) continue;
    const key = fold(hint);
    if (!key || seen.has(key)) continue;
    if (namesSecret(hint, secret)) continue;
    if (!hintMatchesLang(hint, lang)) continue;
    if (clueConflicts(hint, guessed)) continue;
    seen.add(key);
    cleaned.push(hint);
  }
  return cleaned;
}

function fillLevels(groups: string[][], extras: string[]): HintLevels | null {
  const used = new Set<string>();
  const levels: string[][] = [[], [], []];
  for (let i = 0; i < HINT_LEVELS; i += 1) {
    for (const hint of groups[i] ?? []) {
      const key = fold(hint);
      if (!key || used.has(key) || levels[i].length >= HINTS_PER_LEVEL) continue;
      used.add(key);
      levels[i].push(hint);
    }
  }
  const leftover = extras.filter((hint) => {
    const key = fold(hint);
    if (!key || used.has(key)) return false;
    used.add(key);
    return true;
  });
  for (let i = 0; i < HINT_LEVELS; i += 1) {
    while (levels[i].length < HINTS_PER_LEVEL && leftover.length) {
      levels[i].push(leftover.shift() as string);
    }
  }
  if (levels.every((level) => level.length === HINTS_PER_LEVEL)) {
    return levels as HintLevels;
  }
  return null;
}

function levelsFromUnknown(
  parsed: { levels?: unknown; hints?: unknown },
  secret: string,
  blocked: string[],
  lang: GameLang,
): HintLevels | { error: string } {
  const fromNamed = parsed.levels && typeof parsed.levels === "object" && !Array.isArray(parsed.levels)
    ? parsed.levels as Record<string, unknown>
    : null;
  const fromArray = Array.isArray(parsed.levels) ? parsed.levels : null;
  const rawLevels: unknown[] = fromArray
    ? fromArray
    : fromNamed
      ? [fromNamed["1"] ?? fromNamed.broad, fromNamed["2"] ?? fromNamed.medium, fromNamed["3"] ?? fromNamed.specific]
      : [];

  const groups = rawLevels.slice(0, HINT_LEVELS).map((level) =>
    takeHints(level, secret, blocked, lang, 8),
  );
  const extras = takeHints(parsed.hints, secret, blocked, lang, 16);
  const packed = fillLevels(groups, [...groups.flat(), ...extras]);
  if (packed) return packed;

  const kept = groups.reduce((sum, level) => sum + level.length, 0);
  return {
    error:
      lang === "en"
        ? `need 9 unique English hints in 3 levels (kept ${kept})`
        : `ต้องได้คำใบ้ 9 ข้อ คนละระดับ ระดับละ 3 ข้อ (เหลือ ${kept})`,
  };
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
): { pack: HintPack; factError?: string } | { error: string } {
  const cats = categoriesFor(secret, lang);
  const tryParse = (
    text: string,
  ): { pack: HintPack; factError?: string } | { error: string } => {
    try {
      const parsed = JSON.parse(text) as {
        hints?: unknown;
        levels?: unknown;
        meaning?: unknown;
      };
      let meaning: string | undefined;
      if (typeof parsed.meaning === "string" && parsed.meaning.trim()) {
        meaning = parsed.meaning.trim();
        console.info(`[hints] model gloss: ${meaning}`);
        const glossError = glossFactError(secret, meaning, cats);
        if (glossError) return { error: glossError };
      }
      const levels = levelsFromUnknown(parsed, secret, blocked, lang);
      if ("error" in levels) return levels;
      const pack: HintPack = { meaning, levels };
      const factError = lang === "th" ? hintFactError(secret, levels.flat(), cats) : null;
      if (factError) {
        console.warn(`[hints] fact-check: ${factError} rejected for ${secret}`);
        return { pack, factError: hintFactRejectMessage(factError, levels.flat()) };
      }
      return { pack };
    } catch {
      return { error: "invalid JSON" };
    }
  };

  const direct = tryParse(raw.trim());
  if ("pack" in direct) return direct;
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
    `Identify this ${language} word first, then write 12 unique Contexto hint candidates in ${language} (4 per level). We keep 9.`,
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
    "All 9 hints point at the same secret, but none may repeat a phrase or the same fact.",
    "Level 1 — 4 broad true properties (category / what kind of thing it is).",
    "Level 2 — 4 medium true traits (use, context, or subtype).",
    "Level 3 — 4 distinctive true traits that still do not name it.",
    "No guessed words. No empty labels.",
    options.rejectReason ? `REJECTED LAST ATTEMPT: ${options.rejectReason}` : "",
    'Return ONLY JSON {"meaning":"english gloss of THIS word","levels":{"1":["","","",""],"2":["","","",""],"3":["","","",""]}}.',
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
  return hasLlm();
}

async function llmComplete(
  client: OpenAI,
  model: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  temperature = 0.2,
  maxTokens = 900,
): Promise<string | null> {
  const response = await client.chat.completions.create(
    withProviderParams({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages,
    }) as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  );
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
  pack: HintPack,
  why: string,
): Promise<HintPack | null> {
  const cats = categoriesFor(options.secret, options.lang);
  const started = Date.now();
  try {
    const raw = await llmComplete(client, model, [
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
          `These 9 hints in 3 levels failed a fact-check: ${JSON.stringify(pack.levels)}`,
          `Reason: ${why}`,
          "Write 9 corrected unique hints (3 per level) that are factually true of THIS exact spelling — not a similar word.",
          'Return {"ok":false,"why":"short reason","levels":{"1":["","",""],"2":["","",""],"3":["","",""]}}.',
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
    return parsed.pack;
  } catch (error) {
    throwIfRateLimited(error);
    console.warn(
      `[hints] groq audit error in ${Date.now() - started}ms:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

const RETRY_TEMPERATURE = [0.2, 0.4, 0.55, 0.7];

export async function generateHintPackWithGroq(options: HintGenOptions): Promise<HintPack | null> {
  const client = llmClient();
  if (!client) return null;

  const model = llmModel();
  const provider = llmProvider() ?? "llm";
  const language = options.lang === "th" ? "Thai" : "English";

  let rejectReason = options.rejectReason;
  for (let attempt = 1; attempt <= RETRY_TEMPERATURE.length; attempt += 1) {
    const started = Date.now();
    const temperature = RETRY_TEMPERATURE[attempt - 1] ?? 0.5;
    try {
      const raw = await llmComplete(
        client,
        model,
        [
          {
            role: "system",
            content:
              `Identify the exact ${language} spelling, not a similar-looking word. Return only JSON with keys meaning and levels. Each level needs 4 short unique hints. Hints must be in ${language} only. Never put the secret in a hint. False physical traits are forbidden.`,
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
          `[hints] ${provider} ${model} attempt ${attempt} failed in ${Date.now() - started}ms: ${parsed.error}`,
        );
        continue;
      }

      if (!parsed.factError && isCompleteHintPack(parsed.pack)) {
        console.info(`[hints] ${provider} ${model} ok in ${Date.now() - started}ms`);
        return parsed.pack;
      }

      const audited = await auditCluePackWithGroq(
        client,
        model,
        options,
        parsed.pack,
        parsed.factError ?? "incomplete pack",
      );
      if (audited && isCompleteHintPack(audited)) {
        console.info(`[hints] ${provider} ${model} repaired in ${Date.now() - started}ms`);
        return audited;
      }
      rejectReason = parsed.factError ?? "incomplete pack";
      console.info(`[hints] ${provider} ${model} attempt ${attempt} failed local check`);
    } catch (error) {
      throwIfRateLimited(error);
      console.warn(
        `[hints] ${provider} attempt ${attempt} failed in ${Date.now() - started}ms:`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }
  return null;
}

export async function generateHintPackForSecret(secret: string, lang: GameLang): Promise<HintPack | null> {
  return generateHintPackWithGroq({
    secret,
    lang,
    nearby: [],
    blocked: [secret],
  });
}
