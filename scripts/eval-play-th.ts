import { loadThaiGloveVectors } from "../src/lib/th-glove";
import { loadVocabulary } from "../src/lib/words";
import { loadWordSenses, relatednessScore, type WordSense } from "../src/lib/categories";
import {
  categoriesFor,
  loadWordCategories,
  sharesAnyCategory,
  sharesPrimaryCategory,
} from "../src/lib/categories";

const SECRETS = ["ทอฟฟี่", "เสาวรส", "แมว", "กิ่ง", "ฟ้า", "แดง", "บ้าน", "รถ", "นม", "ครู"];

function scoreWord(
  secretVec: number[],
  secretSense: WordSense | undefined,
  word: string,
  wordVec: number[],
  wordSense: WordSense | undefined,
) {
  let dot = 0;
  for (let i = 0; i < secretVec.length; i += 1) dot += secretVec[i] * wordVec[i];
  const relatedness = relatednessScore(secret, secretSense, word, wordSense);
  return dot + relatedness;
}

function pickHalfway(byRank: Map<number, string>, target: number) {
  for (let rank = target; rank >= 2; rank -= 1) {
    const word = byRank.get(rank);
    if (word) return { word, rank };
  }
  return null;
}

function pickNearby(
  byRank: Map<number, string>,
  centerRank: number,
  eligible: (word: string) => boolean,
  maxDist: number,
  minRank: number,
) {
  const seen = new Set<number>();
  const floor = Math.max(2, minRank);
  for (let dist = 0; dist <= maxDist; dist += 1) {
    for (const rank of [centerRank - dist, centerRank + dist]) {
      if (rank < floor || seen.has(rank)) continue;
      seen.add(rank);
      const word = byRank.get(rank);
      if (word && eligible(word)) return { word, rank };
    }
  }
  return null;
}

async function main() {
  const vocab = loadVocabulary("th");
  const vectors = await loadThaiGloveVectors(new Set(vocab));
  const senses = loadWordSenses("th");
  const categories = loadWordCategories("th");
  console.log(`vocab ${vocab.length} vectors ${vectors.size}`);

  for (const secret of SECRETS) {
    const secretVec = vectors.get(secret);
    const secretSense = senses.get(secret);
    if (!secretVec) {
      console.log(`\n## ${secret} MISSING VECTOR`);
      continue;
    }
    const scored: Array<{ word: string; score: number }> = [];
    for (const word of vocab) {
      if (word === secret) continue;
      const wordVec = vectors.get(word);
      if (!wordVec) continue;
      scored.push({
        word,
        score: scoreWord(secretVec, secretSense, word, wordVec, senses.get(word)),
      });
    }
    scored.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word, "th"));
    const ranks = new Map<string, number>([[secret, 1]]);
    const byRank = new Map<number, string>([[1, secret]]);
    scored.forEach((row, index) => {
      ranks.set(row.word, index + 2);
      byRank.set(index + 2, row.word);
    });

    const secretCats = secretSense?.categories ?? [];
    console.log(`\n## ${secret}  [${secretCats.join(" > ") || "?"}]`);
    console.log(
      "top15:",
      scored
        .slice(0, 15)
        .map((row, i) => `${i + 2}.${row.word}(${categories.get(row.word)?.[0] ?? "-"})`)
        .join("  "),
    );

    const probes = ["ผลไม้", "สัตว์", "อาหาร", "สี", "ขนม", "น้ำตาล", "ต้นไม้", "ท้องฟ้า", "คน", "สถานที่"];
    const probeText = probes
      .map((word) => (ranks.has(word) ? `${word}=${ranks.get(word)}` : null))
      .filter(Boolean)
      .join("  ");
    console.log("probes:", probeText);

    const samePrimary = (word: string) =>
      sharesPrimaryCategory(secretCats, categoriesFor(word, "th", categories));
    const sameRelated = (word: string) =>
      sharesAnyCategory(secretCats, categoriesFor(word, "th", categories));

    const hints: string[] = [];
    const guessed = new Set<string>();
    let best = Infinity;
    for (let i = 0; i < 3; i += 1) {
      const target = Number.isFinite(best) ? Math.ceil(best / 2) : 80;
      let picked: { word: string; rank: number } | null = null;
      for (let rank = target; rank >= 2; rank -= 1) {
        const word = byRank.get(rank);
        if (word && !guessed.has(word)) {
          picked = { word, rank };
          break;
        }
      }
      if (!picked) break;
      if (secretCats.length && !samePrimary(picked.word)) {
        const nearby = Math.max(40, Math.floor(picked.rank * 0.75));
        const bandMin = Math.max(2, Math.floor(picked.rank * 0.75));
        const inBand =
          pickNearby(byRank, picked.rank, (word) => !guessed.has(word) && samePrimary(word), nearby, bandMin) ??
          pickNearby(byRank, picked.rank, (word) => !guessed.has(word) && sameRelated(word), nearby, bandMin);
        if (inBand) picked = inBand;
        else {
          const floor = Math.min(picked.rank, 10);
          picked =
            pickNearby(byRank, picked.rank, (word) => !guessed.has(word) && samePrimary(word), 20_000, floor) ??
            pickNearby(byRank, picked.rank, (word) => !guessed.has(word) && sameRelated(word), 20_000, floor) ??
            picked;
        }
      }
      hints.push(`${picked.word}#${picked.rank}/${categories.get(picked.word)?.[0] ?? "-"}`);
      guessed.add(picked.word);
      best = Math.min(best, picked.rank);
    }
    console.log("hints:", hints.join("  "));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
