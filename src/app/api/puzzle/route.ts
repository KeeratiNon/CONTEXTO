import { startGame } from "@/lib/game";
import { jsonError } from "@/lib/http";
import { parseLang } from "@/lib/lang";
import { todayDate } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || todayDate();
    const lang = parseLang(url.searchParams.get("lang"));
    return Response.json(await startGame("daily", date, lang));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      mode?: string;
      date?: string;
      lang?: string;
      secret?: string;
    };
    const lang = parseLang(body.lang);
    if (body.mode === "unlimited") {
      return Response.json(await startGame("unlimited", undefined, lang, body.secret));
    }
    return Response.json(await startGame("daily", body.date || todayDate(), lang));
  } catch (error) {
    return jsonError(error);
  }
}
