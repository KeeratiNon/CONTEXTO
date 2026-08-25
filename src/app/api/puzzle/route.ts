import { jsonError } from "@/lib/http";
import { parseLang } from "@/lib/lang";
import { createUnlimitedPuzzle, getOrCreateDailyPuzzle, toPuzzleMeta } from "@/lib/puzzle";
import { MAX_HINTS } from "@/lib/types";
import { getCachedRanks, requireSeedMeta } from "@/lib/vectordb";
import { todayDate } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function withPuzzleMeta(
  puzzle: ReturnType<typeof getOrCreateDailyPuzzle>,
  vocabSize: number,
) {
  await getCachedRanks(puzzle.id, puzzle.secret);
  const planned =
    puzzle.cluesSource === "ai" && puzzle.clues?.length === MAX_HINTS
      ? puzzle.clues
      : [];
  return toPuzzleMeta(puzzle, vocabSize, planned);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || todayDate();
    const lang = parseLang(url.searchParams.get("lang"));
    const seed = requireSeedMeta(lang);
    const puzzle = getOrCreateDailyPuzzle(date, lang);
    return Response.json(await withPuzzleMeta(puzzle, seed.vocabSize));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { mode?: string; date?: string; lang?: string };
    const lang = parseLang(body.lang);
    const seed = requireSeedMeta(lang);
    if (body.mode === "unlimited") {
      const puzzle = createUnlimitedPuzzle(lang);
      return Response.json(await withPuzzleMeta(puzzle, seed.vocabSize));
    }
    const puzzle = getOrCreateDailyPuzzle(body.date || todayDate(), lang);
    return Response.json(await withPuzzleMeta(puzzle, seed.vocabSize));
  } catch (error) {
    return jsonError(error);
  }
}
