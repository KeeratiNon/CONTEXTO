import { jsonError } from "@/lib/http";
import { parseLang } from "@/lib/lang";
import { playableSecrets } from "@/lib/prepared";
import { loadSecrets } from "@/lib/words";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const lang = parseLang(new URL(request.url).searchParams.get("lang"));
    return Response.json({ secrets: playableSecrets(lang, loadSecrets(lang)) });
  } catch (error) {
    return jsonError(error);
  }
}
