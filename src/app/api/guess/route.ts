import { submitGuess } from "@/lib/game";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { puzzleId?: string; word?: string };
    if (!body.puzzleId || !body.word) {
      return Response.json(
        { error: "invalid_request", message: "puzzleId and word are required." },
        { status: 400 },
      );
    }
    const result = await submitGuess(body.puzzleId, body.word);
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
