import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const LANCEDB_DIR = path.join(DATA_DIR, "lancedb");
export const RANKS_DIR = path.join(DATA_DIR, "ranks");
export const PUZZLES_DIR = path.join(DATA_DIR, "puzzles");
export const MODELS_DIR = path.join(DATA_DIR, "models");
export const RAW_DIR = path.join(DATA_DIR, "raw");
export const META_PATH = path.join(DATA_DIR, "meta.json");
export const VOCAB_PATH = path.join(DATA_DIR, "vocabulary.txt");
export const VOCAB_META_PATH = path.join(DATA_DIR, "vocab-meta.json");
export const SECRETS_PATH = path.join(DATA_DIR, "secrets.txt");
export const FREQUENCY_PATH = path.join(RAW_DIR, "en_50k.txt");
export const GLOVE_DIR = path.join(MODELS_DIR, "glove");
export const GLOVE_ZIP_PATH = path.join(GLOVE_DIR, "glove.6B.zip");
