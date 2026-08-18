export function todayDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const GAME_EPOCH = Date.UTC(2022, 4, 22);

export function gameNumberForDate(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  return Math.floor((timestamp - GAME_EPOCH) / 86_400_000) + 1;
}
