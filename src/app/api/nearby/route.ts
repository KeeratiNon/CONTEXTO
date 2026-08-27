import { listNearby } from "@/lib/game";
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
    return Response.json(await listNearby(body.puzzleId, 500));
  } catch (error) {
    return jsonError(error);
  }
}
