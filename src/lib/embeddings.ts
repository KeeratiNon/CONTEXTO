import fs from "node:fs";
import OpenAI from "openai";
import { GLOVE_DIMENSIONS, GLOVE_MODEL, loadGloveVectors } from "./glove";
import { FASTTEXT_DIMENSIONS, FASTTEXT_MODEL, loadThaiFasttextVectors } from "./fasttext";
import { THAI_GLOVE_DIMENSIONS, THAI_GLOVE_MODEL, loadThaiGloveVectors } from "./th-glove";
import { pathsFor } from "./paths";
import type { EmbeddingProvider } from "./types";
import { parseLang, type GameLang } from "./lang";

export type EmbeddingModel = {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  embed: (texts: string[]) => Promise<number[][]>;
  hasWord?: (word: string) => boolean;
};

const LOCAL_MODEL_EN = "Xenova/all-MiniLM-L6-v2";
const LOCAL_MODEL_TH = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
const OPENAI_MODEL = "text-embedding-3-small";

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

async function createLocalEmbedder(lang: GameLang): Promise<EmbeddingModel> {
  const transformers = await import("@huggingface/transformers");
  const model = lang === "th" ? LOCAL_MODEL_TH : LOCAL_MODEL_EN;
  const cacheDir = pathsFor(lang).modelsDir;
  transformers.env.cacheDir = cacheDir;
  fs.mkdirSync(cacheDir, { recursive: true });

  console.log(`Loading local model ${model}...`);
  const extractor = await transformers.pipeline("feature-extraction", model, { dtype: "fp32" });

  return {
    provider: "local",
    model,
    dimensions: 384,
    embed: async (texts: string[]) => {
      const vectors: number[][] = [];
      const batches = chunk(texts, lang === "th" ? 64 : 32);
      for (const [index, batch] of batches.entries()) {
        const output = await extractor(batch, {
          pooling: "mean",
          normalize: true,
        });
        const list = output.tolist() as number[][];
        vectors.push(...list);
        if ((index + 1) % 5 === 0 || index === batches.length - 1) {
          console.log(`  local embed ${Math.min(vectors.length, texts.length)}/${texts.length}`);
        }
      }
      return vectors;
    },
  };
}

function createOpenAIEmbedder(): EmbeddingModel {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai");
  }

  const client = new OpenAI({ apiKey });

  return {
    provider: "openai",
    model: OPENAI_MODEL,
    dimensions: 1536,
    embed: async (texts: string[]) => {
      const vectors: number[][] = [];
      for (const batch of chunk(texts, 512)) {
        const response = await client.embeddings.create({
          model: OPENAI_MODEL,
          input: batch,
        });
        const ordered = [...response.data].sort((a, b) => a.index - b.index);
        vectors.push(...ordered.map((item) => item.embedding));
      }
      return vectors;
    },
  };
}

async function createGloveEmbedder(vocab: string[]): Promise<EmbeddingModel> {
  console.log(`Loading ${GLOVE_MODEL} for ${vocab.length} words...`);
  const table = await loadGloveVectors(new Set(vocab));
  console.log(`GloVe coverage: ${table.size}/${vocab.length} words`);

  return {
    provider: "glove",
    model: GLOVE_MODEL,
    dimensions: GLOVE_DIMENSIONS,
    hasWord: (word) => table.has(word),
    embed: async (texts: string[]) =>
      texts.map((word) => {
        const vector = table.get(word);
        if (!vector) {
          throw new Error(`No GloVe vector for "${word}"`);
        }
        return vector;
      }),
  };
}

async function createFasttextEmbedder(vocab: string[]): Promise<EmbeddingModel> {
  console.log(`Loading ${FASTTEXT_MODEL} for ${vocab.length} words...`);
  const table = await loadThaiFasttextVectors(new Set(vocab));
  console.log(`fastText coverage: ${table.size}/${vocab.length} words`);

  return {
    provider: "fasttext",
    model: FASTTEXT_MODEL,
    dimensions: FASTTEXT_DIMENSIONS,
    hasWord: (word) => table.has(word),
    embed: async (texts: string[]) =>
      texts.map((word) => {
        const vector = table.get(word);
        if (!vector) {
          throw new Error(`No fastText vector for "${word}"`);
        }
        return vector;
      }),
  };
}

async function createThaiGloveEmbedder(vocab: string[]): Promise<EmbeddingModel> {
  console.log(`Loading ${THAI_GLOVE_MODEL} for ${vocab.length} words...`);
  const table = await loadThaiGloveVectors(new Set(vocab));
  console.log(`Thai GloVe coverage: ${table.size}/${vocab.length} words`);

  return {
    provider: "glove",
    model: THAI_GLOVE_MODEL,
    dimensions: THAI_GLOVE_DIMENSIONS,
    hasWord: (word) => table.has(word),
    embed: async (texts: string[]) =>
      texts.map((word) => {
        const vector = table.get(word);
        if (!vector) {
          throw new Error(`No Thai GloVe vector for "${word}"`);
        }
        return vector;
      }),
  };
}

export function providerFromEnv(lang: GameLang = parseLang(process.env.LANGUAGE)): EmbeddingProvider {
  const raw = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (raw === "openai" || raw === "local" || raw === "glove" || raw === "fasttext") return raw;
  return "glove";
}

export async function createEmbedder(
  vocab: string[] = [],
  provider: EmbeddingProvider = providerFromEnv(),
  lang: GameLang = parseLang(process.env.LANGUAGE),
): Promise<EmbeddingModel> {
  if (provider === "openai") return createOpenAIEmbedder();
  if (provider === "local") return createLocalEmbedder(lang);
  if (provider === "fasttext") return createFasttextEmbedder(vocab);
  if (lang === "th") return createThaiGloveEmbedder(vocab);
  return createGloveEmbedder(vocab);
}
