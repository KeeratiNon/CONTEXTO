export type GameLang = "en" | "th";

export function parseLang(raw: unknown): GameLang {
  return String(raw ?? "").trim().toLowerCase() === "th" ? "th" : "en";
}

export function langFromPuzzleId(id: string): GameLang {
  if (id.startsWith("daily-th-") || id.startsWith("ul-th-")) return "th";
  return "en";
}

export function dailyPuzzleId(date: string, lang: GameLang): string {
  return lang === "th" ? `daily-th-${date}` : `daily-${date}`;
}

export function parseDailyPuzzleId(id: string): { lang: GameLang; date: string } | null {
  if (id.startsWith("daily-th-")) {
    const date = id.slice("daily-th-".length);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? { lang: "th", date } : null;
  }
  if (id.startsWith("daily-")) {
    const date = id.slice("daily-".length);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? { lang: "en", date } : null;
  }
  return null;
}

export function hasThaiScript(text: string): boolean {
  return /[\u0E00-\u0E7F]/.test(text);
}

export function hintMatchesLang(hint: string, lang: GameLang): boolean {
  if (lang === "en") return !hasThaiScript(hint);
  return !/[A-Za-z]{3,}/.test(hint);
}

export function cluesMatchLang(clues: string[], lang: GameLang): boolean {
  return clues.length > 0 && clues.every((clue) => hintMatchesLang(clue, lang));
}

export function isThaiGuessToken(word: string): boolean {
  if (word.length < 2 || word.length > 18) return false;
  if (!/^[\u0E00-\u0E7F]+$/.test(word)) return false;
  if (!/[\u0E01-\u0E2E]/.test(word)) return false;
  if (word.includes("ๆ")) return false;
  return true;
}
