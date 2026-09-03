import OpenAI from "openai";

const TIMEOUT_MS = 20_000;
const GEMINI_TIMEOUT_MS = 60_000;

export type LlmProvider = "gemini" | "groq";

export function llmProvider(): LlmProvider | null {
  if (process.env.GROQ_API_KEY?.trim()) return "groq";
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  return null;
}

export function hasLlm(): boolean {
  return llmProvider() !== null;
}

export function llmModel(): string {
  if (llmProvider() === "gemini") {
    return process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  }
  return process.env.GROQ_HINT_MODEL?.trim() || "openai/gpt-oss-120b";
}

export function llmClient(): OpenAI | null {
  const groq = process.env.GROQ_API_KEY?.trim();
  if (groq) {
    return new OpenAI({
      apiKey: groq,
      baseURL: "https://api.groq.com/openai/v1",
      timeout: TIMEOUT_MS,
    });
  }
  const gemini = process.env.GEMINI_API_KEY?.trim();
  if (!gemini) return null;
  return new OpenAI({
    apiKey: gemini,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    timeout: GEMINI_TIMEOUT_MS,
  });
}

export function withProviderParams<T extends object>(params: T): T {
  const provider = llmProvider();
  if (provider === "groq") {
    return { ...params, reasoning_effort: "low" };
  }
  if (provider === "gemini") {
    return {
      ...params,
      extra_body: {
        google: {
          thinking_config: { thinking_level: "minimal" },
        },
      },
    };
  }
  return params;
}

export class LlmRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmRateLimitError";
  }
}

export function isRateLimitMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    message.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota exceeded") ||
    lower.includes("exceeded your current quota")
  );
}

export function throwIfRateLimited(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (isRateLimitMessage(message)) {
    throw new LlmRateLimitError(message);
  }
}
