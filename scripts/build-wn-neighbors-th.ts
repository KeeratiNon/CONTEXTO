/**
 * Build Thai WordNet neighbor lists from existing synset ids.
 * Does not rewrite thai-contexto-70k.jsonl.
 *
 *   npm run build-wn-neighbors:th
 */
import fs from "node:fs";
import path from "node:path";
import { pathsFor } from "../src/lib/paths";

type SynsetRel = {
  similar: string[];
  hypernyms: string[];
  hyponyms: string[];
};

function parseSynsets(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string" && Boolean(item));
  if (typeof raw === "string" && raw.trim()) return raw.split("|").filter(Boolean);
  return [];
}

function posFromFile(file: string): string {
  if (file.endsWith("data.verb")) return "v";
  if (file.endsWith("data.adj")) return "a";
  if (file.endsWith("data.adv")) return "r";
  return "n";
}

function synsetKey(offset: string, pos: string): string {
  return `${offset}-${pos}`;
}

function loadRelations(dict: string): Map<string, SynsetRel> {
  const map = new Map<string, SynsetRel>();
  const files = ["data.noun", "data.verb", "data.adj", "data.adv"];
  for (const file of files) {
    const pos = posFromFile(file);
    const text = fs.readFileSync(path.join(dict, file), "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith(" ")) continue;
      const header = line.split(" | ")[0] ?? line;
      const parts = header.split(" ");
      if (parts.length < 5) continue;
      const offset = parts[0];
      const wordCount = parseInt(parts[3] ?? "0", 16);
      if (!offset || !Number.isFinite(wordCount)) continue;
      let cursor = 4 + wordCount * 2;
      const pointerCount = Number(parts[cursor] ?? 0);
      cursor += 1;
      const similar: string[] = [];
      const hypernyms: string[] = [];
      const hyponyms: string[] = [];
      for (let i = 0; i < pointerCount; i += 1) {
        const symbol = parts[cursor] ?? "";
        const target = parts[cursor + 1] ?? "";
        const targetPos = parts[cursor + 2] ?? pos;
        cursor += 4;
        if (!target) continue;
        const key = synsetKey(target, targetPos === "s" ? "a" : targetPos);
        if (symbol === "&") similar.push(key);
        else if (symbol === "@" || symbol === "@i") hypernyms.push(key);
        else if (symbol === "~" || symbol === "~i") hyponyms.push(key);
      }
      const rel: SynsetRel = { similar, hypernyms, hyponyms };
      map.set(synsetKey(offset, pos), rel);
      if (pos === "a") map.set(synsetKey(offset, "s"), rel);
    }
  }
  return map;
}

function relatedSynsets(start: string[], rels: Map<string, SynsetRel>): Set<string> {
  const related = new Set(start);
  for (const id of start) {
    const rel = rels.get(id);
    if (!rel) continue;
    for (const item of rel.similar) related.add(item);
    for (const item of rel.hypernyms) related.add(item);
    for (const item of rel.hyponyms) related.add(item);
    for (const hub of rel.similar) {
      const hubRel = rels.get(hub);
      if (!hubRel) continue;
      for (const item of hubRel.similar) related.add(item);
    }
  }
  return related;
}

function main() {
  const paths = pathsFor("th");
  const dict = path.join(paths.rawDir, "wordnet-3.0", "dict");
  if (!fs.existsSync(path.join(dict, "data.noun"))) {
    if (fs.existsSync(paths.wnNeighborsPath)) {
      console.log(`WordNet 3.0 not on this machine; keeping ${paths.wnNeighborsPath}`);
      return;
    }
    console.warn(`WordNet 3.0 missing at ${dict}; skip neighbor rebuild (ranking still works).`);
    return;
  }

  const synsetsOf = new Map<string, string[]>();
  const wordsOf = new Map<string, string[]>();
  for (const line of fs.readFileSync(paths.categoriesPath, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const raw = JSON.parse(line.replace(/:\s*NaN\b/g, ": null")) as {
      word?: string;
      synsets?: unknown;
    };
    const word = raw.word?.trim();
    const synsets = parseSynsets(raw.synsets);
    if (!word || !synsets.length) continue;
    synsetsOf.set(word, synsets);
    for (const id of synsets) {
      const list = wordsOf.get(id) ?? [];
      list.push(word);
      wordsOf.set(id, list);
    }
  }

  const rels = loadRelations(dict);
  const neighbors: Record<string, string[]> = {};
  let linked = 0;
  for (const [word, synsets] of synsetsOf) {
    const related = relatedSynsets(synsets, rels);
    const found = new Set<string>();
    for (const id of related) {
      for (const other of wordsOf.get(id) ?? []) {
        if (other !== word) found.add(other);
      }
    }
    if (!found.size) continue;
    neighbors[word] = [...found].sort((a, b) => a.localeCompare(b, "th"));
    linked += 1;
  }

  fs.writeFileSync(paths.wnNeighborsPath, JSON.stringify(neighbors));
  console.log(
    `Wrote ${paths.wnNeighborsPath} (${linked} words, ${(fs.statSync(paths.wnNeighborsPath).size / 1024 / 1024).toFixed(1)}MB)`,
  );
  for (const sample of ["เทา", "ขาว", "ดำ", "โจ๊ก", "เขียว"]) {
    const list = neighbors[sample] ?? [];
    console.log(`${sample}: ${list.slice(0, 12).join(", ") || "(none)"}${list.length > 12 ? ` … +${list.length - 12}` : ""}`);
  }
}

main();
