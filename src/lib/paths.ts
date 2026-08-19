import path from "node:path";
import type { GameLang } from "./lang";

export const DATA_DIR = path.join(process.cwd(), "data");

export function pathsFor(lang: GameLang) {
  const root = path.join(DATA_DIR, lang);
  return {
    root,
    lancedbDir: path.join(root, "lancedb"),
    ranksDir: path.join(root, "ranks"),
    puzzlesDir: path.join(root, "puzzles"),
    modelsDir: path.join(root, "models"),
    rawDir: path.join(root, "raw"),
    metaPath: path.join(root, "meta.json"),
    vocabPath: path.join(root, "vocabulary.txt"),
    vocabMetaPath: path.join(root, "vocab-meta.json"),
    secretsPath: path.join(root, "secrets.txt"),
    frequencyPath: path.join(root, "raw", lang === "th" ? "th_50k.txt" : "en_50k.txt"),
    thaiGlovePath: path.join(root, "raw", "th.glove.300d.top30k.txt"),
    thaiGloveGzipPath: path.join(root, "th.glove.300d.top30k.txt.gz"),
  };
}

const EN = pathsFor("en");

export const LANCEDB_DIR = EN.lancedbDir;
export const RANKS_DIR = EN.ranksDir;
export const PUZZLES_DIR = EN.puzzlesDir;
export const MODELS_DIR = EN.modelsDir;
export const RAW_DIR = EN.rawDir;
export const META_PATH = EN.metaPath;
export const VOCAB_PATH = EN.vocabPath;
export const VOCAB_META_PATH = EN.vocabMetaPath;
export const SECRETS_PATH = EN.secretsPath;
export const FREQUENCY_PATH = EN.frequencyPath;
export const GLOVE_DIR = path.join(EN.modelsDir, "glove");
export const GLOVE_ZIP_PATH = path.join(GLOVE_DIR, "glove.6B.zip");
export const FASTTEXT_DIR = path.join(pathsFor("th").modelsDir, "fasttext");
export const FASTTEXT_GZ_PATH = path.join(FASTTEXT_DIR, "cc.th.300.vec.gz");
