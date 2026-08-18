import { giveUp } from "@/lib/game";
import { jsonError } from "@/lib/http";

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
    const result = await giveUp(body.puzzleId);
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
