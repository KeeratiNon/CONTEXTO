import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@lancedb/lancedb",
    "@huggingface/transformers",
    "onnxruntime-node",
  ],
  outputFileTracingIncludes: {
    "/*": [
      "./data/th/secrets.txt",
      "./data/th/vocabulary.txt",
      "./data/th/prepared/**/*",
      "./data/th/thai-contexto-70k.jsonl",
      "./data/th/wn-neighbors.json",
    ],
  },
};

export default nextConfig;
