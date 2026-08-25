import { preparePuzzleClues } from "@/lib/game";
import { jsonError } from "@/lib/http";
import { loadPuzzle } from "@/lib/puzzle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { puzzleId?: string };
    if (!body.puzzleId) {
      return Response.json(
        { error: "invalid_request", message: "puzzleId is required." },
        { status: 400 },
      );
    }
    const puzzle = loadPuzzle(body.puzzleId);
    const planned = await preparePuzzleClues(puzzle);
    return Response.json({ planned, ready: planned.length === 3 });
  } catch (error) {
    return jsonError(error);
  }
}
