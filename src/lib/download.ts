import fs from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

export async function downloadToFile(url: string, dest: string) {
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 60_000);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "contexto-seed/0.1" },
    });
  } finally {
    clearTimeout(abortTimer);
  }
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} downloading ${url}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(`Got HTML instead of a zip from ${url}`);
  }

  const total = Number(response.headers.get("content-length")) || 0;
  let received = 0;
  let lastLogged = 0;
  const tmp = `${dest}.part`;
  const progress = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (total > 0 && received - lastLogged >= total / 10) {
        lastLogged = received;
        const pct = Math.min(100, Math.round((received / total) * 100));
        console.log(`  ${pct}% (${(received / 1e6).toFixed(0)}MB)`);
      }
      callback(null, chunk);
    },
  });

  await pipeline(
    Readable.fromWeb(response.body as WebReadableStream<Uint8Array>),
    progress,
    fs.createWriteStream(tmp),
  );
  fs.renameSync(tmp, dest);
}

export function l2normalize(values: number[]): number[] {
  let sumSquares = 0;
  for (const value of values) sumSquares += value * value;
  const norm = Math.sqrt(sumSquares) || 1;
  return values.map((value) => value / norm);
}
