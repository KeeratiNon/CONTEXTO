import { jsonError } from "@/lib/http";
import { createUnlimitedPuzzle, getOrCreateDailyPuzzle, toPuzzleMeta } from "@/lib/puzzle";
import { getCachedRanks, requireSeedMeta } from "@/lib/vectordb";
import { todayDate } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || todayDate();
    const seed = requireSeedMeta();
    const puzzle = getOrCreateDailyPuzzle(date);
    await getCachedRanks(puzzle.id, puzzle.secret);
    return Response.json(toPuzzleMeta(puzzle, seed.vocabSize));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { mode?: string; date?: string };
    const seed = requireSeedMeta();
    if (body.mode === "unlimited") {
      const puzzle = createUnlimitedPuzzle();
      await getCachedRanks(puzzle.id, puzzle.secret);
      return Response.json(toPuzzleMeta(puzzle, seed.vocabSize));
    }
    const puzzle = getOrCreateDailyPuzzle(body.date || todayDate());
    await getCachedRanks(puzzle.id, puzzle.secret);
    return Response.json(toPuzzleMeta(puzzle, seed.vocabSize));
  } catch (error) {
    return jsonError(error);
  }
}
