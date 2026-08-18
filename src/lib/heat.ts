export const GREEN_MAX = 300;
export const YELLOW_MAX = 1500;

export type RankZone = "green" | "yellow" | "red";

export function rankZone(rank: number): RankZone {
  if (rank <= GREEN_MAX) return "green";
  if (rank <= YELLOW_MAX) return "yellow";
  return "red";
}

export function rankEmoji(rank: number): string {
  const zone = rankZone(rank);
  if (zone === "green") return "🟩";
  if (zone === "yellow") return "🟨";
  return "🟥";
}

export function rankToPercent(rank: number, vocabSize: number): number {
  if (rank <= 1) return 100;
  const max = Math.max(vocabSize, 2);
  const t = Math.log(rank) / Math.log(max);
  return Math.max(3, Math.min(100, 100 * (1 - t) ** 0.7));
}

export function rankToColor(rank: number): string {
  let hue: number;
  let sat = 78;
  let light = 46;

  if (rank <= GREEN_MAX) {
    const t = (rank - 1) / Math.max(GREEN_MAX - 1, 1);
    hue = 142 - t * 54;
    light = 42 + t * 6;
  } else if (rank <= YELLOW_MAX) {
    const t = (rank - GREEN_MAX) / (YELLOW_MAX - GREEN_MAX);
    hue = 88 - t * 50;
    sat = 82;
    light = 48;
  } else {
    const t = Math.min(1, (rank - YELLOW_MAX) / 8000);
    hue = 38 - t * 38;
    sat = 76;
    light = 48 - t * 8;
  }

  return `hsl(${Math.round(hue)} ${sat}% ${light}%)`;
}

export function winCopy(guesses: number): string {
  if (guesses <= 1) return "Impossible!";
  if (guesses <= 5) return "Incredible!";
  if (guesses <= 10) return "Impressive!";
  if (guesses <= 20) return "Great!";
  if (guesses <= 35) return "Nice!";
  if (guesses <= 50) return "Not bad.";
  return "You got it.";
}
