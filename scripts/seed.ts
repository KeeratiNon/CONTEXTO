import fs from "node:fs";
import { createEmbedder } from "../src/lib/embeddings";
import { LANCEDB_DIR, META_PATH, MODELS_DIR, PUZZLES_DIR, RANKS_DIR } from "../src/lib/paths";
import { loadVocabulary } from "../src/lib/words";
import type { SeedMeta } from "../src/lib/types";
import * as lancedb from "@lancedb/lancedb";

async function main() {
  const allWords = loadVocabulary();
  if (allWords.length < 1000) {
    throw new Error(`Vocabulary too small (${allWords.length}). Check data/vocabulary.txt`);
  }

  const embedder = await createEmbedder(allWords);
  const vocab = embedder.hasWord
    ? allWords.filter((word) => embedder.hasWord?.(word))
    : allWords;
  const skipped = allWords.length - vocab.length;
  if (skipped > 0) {
    console.log(`Skipping ${skipped} words with no ${embedder.model} vector`);
  }
  if (vocab.length < 1000) {
    throw new Error(`Too few words with embeddings (${vocab.length}).`);
  }

  if (embedder.provider !== "glove" && vocab.length > 20_000) {
    console.log(
      `Warning: ${embedder.provider} will embed ${vocab.length} words. GloVe (npm run seed) is much faster at this size.`,
    );
  }

  console.log(`Seeding ${vocab.length} words into LanceDB...`);
  console.log(`Embedding model: ${embedder.provider} / ${embedder.model} (${embedder.dimensions}d)`);

  const started = Date.now();
  const vectors = await embedder.embed(vocab);
  if (vectors.length !== vocab.length) {
    throw new Error(`Embedding count mismatch: ${vectors.length} vs ${vocab.length}`);
  }

  const rows = vocab.map((word, index) => ({
    word,
    vector: vectors[index],
  }));

  fs.mkdirSync(LANCEDB_DIR, { recursive: true });
  const db = await lancedb.connect(LANCEDB_DIR);
  const existing = await db.tableNames();
  if (existing.includes("words")) {
    await db.dropTable("words");
  }

  const chunkSize = 5000;
  const table = await db.createTable("words", rows.slice(0, chunkSize), { mode: "overwrite" });
  for (let offset = chunkSize; offset < rows.length; offset += chunkSize) {
    await table.add(rows.slice(offset, offset + chunkSize));
    console.log(`  stored ${Math.min(offset + chunkSize, rows.length)}/${rows.length}`);
  }

  fs.rmSync(RANKS_DIR, { recursive: true, force: true });
  fs.rmSync(PUZZLES_DIR, { recursive: true, force: true });

  const meta: SeedMeta = {
    provider: embedder.provider,
    model: embedder.model,
    dimensions: embedder.dimensions,
    vocabSize: vocab.length,
    seededAt: new Date().toISOString(),
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  fs.rmSync(MODELS_DIR, { recursive: true, force: true });

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Done. ${vocab.length} vectors stored in ${seconds}s`);
  console.log(`Removed downloaded embedding files to free disk`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
