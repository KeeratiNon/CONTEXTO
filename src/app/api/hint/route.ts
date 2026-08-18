import { submitHint } from "@/lib/game";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      puzzleId?: string;
      guessed?: string[];
      hintsUsed?: number;
    };
    if (!body.puzzleId) {
      return Response.json(
        { error: "invalid_request", message: "puzzleId is required." },
        { status: 400 },
      );
    }
    const result = await submitHint(
      body.puzzleId,
      body.guessed ?? [],
      body.hintsUsed ?? 0,
    );
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
