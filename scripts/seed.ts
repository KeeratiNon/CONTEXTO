import fs from "node:fs";
import { createEmbedder, providerFromEnv } from "../src/lib/embeddings";
import { pathsFor } from "../src/lib/paths";
import { parseLang } from "../src/lib/lang";
import { loadVocabulary } from "../src/lib/words";
import type { SeedMeta } from "../src/lib/types";
import * as lancedb from "@lancedb/lancedb";

async function main() {
  const lang = parseLang(process.env.LANGUAGE);
  const paths = pathsFor(lang);
  const allWords = loadVocabulary(lang);
  if (allWords.length < 1000) {
    throw new Error(
      `Vocabulary too small (${allWords.length}). Check ${paths.vocabPath}${
        lang === "th" ? " (run npm run build-vocab:th)" : ""
      }`,
    );
  }

  const embedder = await createEmbedder(allWords, providerFromEnv(lang), lang);
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

  if (embedder.provider !== "glove" && embedder.provider !== "fasttext" && vocab.length > 20_000) {
    console.log(
      `Warning: ${embedder.provider} will embed ${vocab.length} words. Pretrained word vectors are much faster at this size.`,
    );
  }

  console.log(`Seeding ${vocab.length} ${lang} words into LanceDB...`);
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

  fs.mkdirSync(paths.lancedbDir, { recursive: true });
  const db = await lancedb.connect(paths.lancedbDir);
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

  fs.rmSync(paths.ranksDir, { recursive: true, force: true });
  fs.rmSync(paths.puzzlesDir, { recursive: true, force: true });

  const meta: SeedMeta = {
    provider: embedder.provider,
    model: embedder.model,
    dimensions: embedder.dimensions,
    vocabSize: vocab.length,
    seededAt: new Date().toISOString(),
  };
  fs.writeFileSync(paths.metaPath, JSON.stringify(meta, null, 2));
  fs.rmSync(paths.modelsDir, { recursive: true, force: true });

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Done. ${vocab.length} ${lang} vectors stored in ${seconds}s`);
  console.log(`Removed downloaded embedding files to free disk`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
