import fs from "node:fs";
import path from "node:path";
import { pathsFor } from "../src/lib/paths";
import { type GameLang } from "../src/lib/lang";
import { isValidWord, normalizeWord } from "../src/lib/words";
import { getOrCreateDailyPuzzle } from "../src/lib/puzzle";
import { getWordsTable, rankAllWords, readSeedMeta } from "../src/lib/vectordb";
import { rankToColor, rankZone } from "../src/lib/heat";

type VocabEntry = { word: string; vocabRank: number };
type PlotPoint = {
  word: string;
  vocabRank: number;
  semanticRank: number;
  zone: "green" | "yellow" | "red";
  color: string;
  pc1: number | null;
  pc2: number | null;
};

type PlotConfig = {
  lang: GameLang;
  sourceLabel: string;
  seedHint: string;
  buildVocabHint: string;
};

const CONFIG: Record<GameLang, PlotConfig> = {
  en: {
    lang: "en",
    sourceLabel: "vocabulary.txt (GloVe 6B ~70k)",
    seedHint: "Run npm run seed first.",
    buildVocabHint: "Run npm run build-vocab first.",
  },
  th: {
    lang: "th",
    sourceLabel: "vocabulary.txt (Thai GloVe ~49k)",
    seedHint: "Run npm run seed:th first.",
    buildVocabHint: "Run npm run build-vocab:th first.",
  },
};

function loadPlayableWords(lang: GameLang): VocabEntry[] {
  const paths = pathsFor(lang);
  const entries: VocabEntry[] = [];
  const seen = new Set<string>();

  for (const filePath of [paths.vocabPath, paths.secretsPath]) {
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const word = normalizeWord(line, lang);
      if (!isValidWord(word, lang) || (lang === "en" && word.length < 3)) continue;
      if (seen.has(word)) continue;
      seen.add(word);
      entries.push({ word, vocabRank: entries.length + 1 });
    }
  }

  return entries;
}

function toNumberArray(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value) && typeof value[0] === "number") return value as number[];
  if (typeof value === "object" && value && "toArray" in value && typeof value.toArray === "function") {
    return Array.from(value.toArray() as ArrayLike<number>);
  }
  if (typeof (value as Iterable<number>)[Symbol.iterator] === "function") {
    return Array.from(value as Iterable<number>);
  }
  return null;
}

/** Incremental covariance + power iteration for top-2 PCA components. */
function pca2(vectors: number[][]): { pc1: number[]; pc2: number[] } {
  const n = vectors.length;
  const d = vectors[0]?.length ?? 0;
  if (n === 0 || d === 0) return { pc1: [], pc2: [] };

  const mean = new Array(d).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < d; i += 1) mean[i] += v[i];
  }
  for (let i = 0; i < d; i += 1) mean[i] /= n;

  const cov = Array.from({ length: d }, () => new Array(d).fill(0));
  for (const v of vectors) {
    for (let i = 0; i < d; i += 1) {
      const ai = v[i] - mean[i];
      for (let j = i; j < d; j += 1) {
        cov[i][j] += ai * (v[j] - mean[j]);
      }
    }
  }
  for (let i = 0; i < d; i += 1) {
    for (let j = i; j < d; j += 1) {
      cov[i][j] /= n;
      if (i !== j) cov[j][i] = cov[i][j];
    }
  }

  function powerIter(exclude?: number[]): number[] {
    let v = new Array(d).fill(0).map(() => Math.random() - 0.5);
    const norm0 = Math.hypot(...v) || 1;
    v = v.map((x) => x / norm0);

    for (let step = 0; step < 40; step += 1) {
      const next = new Array(d).fill(0);
      for (let i = 0; i < d; i += 1) {
        let sum = 0;
        for (let j = 0; j < d; j += 1) sum += cov[i][j] * v[j];
        next[i] = sum;
      }
      if (exclude) {
        const proj = exclude.reduce((acc, e, idx) => acc + next[idx] * exclude[idx], 0);
        for (let i = 0; i < d; i += 1) next[i] -= proj * exclude[i];
      }
      const norm = Math.hypot(...next) || 1;
      v = next.map((x) => x / norm);
    }
    return v;
  }

  const e1 = powerIter();
  const e2 = powerIter(e1);

  const centered = vectors.map((v) => v.map((x, i) => x - mean[i]));
  const pc1 = centered.map((v) => v.reduce((acc, x, i) => acc + x * e1[i], 0));
  const pc2 = centered.map((v) => v.reduce((acc, x, i) => acc + x * e2[i], 0));
  return { pc1, pc2 };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildHtml(config: PlotConfig, secret: string, date: string, points: PlotPoint[]): string {
  const green = points.filter((p) => p.zone === "green");
  const yellow = points.filter((p) => p.zone === "yellow");
  const red = points.filter((p) => p.zone === "red");

  const trace = (items: PlotPoint[], name: string) => ({
    type: "scattergl",
    mode: "markers",
    name,
    x: items.map((p) => p.vocabRank),
    y: items.map((p) => p.semanticRank),
    text: items.map((p) => p.word),
    hovertemplate: items.map(
      (p) =>
        `<b>${escapeHtml(p.word)}</b><br>` +
        `GloVe: #${p.vocabRank.toLocaleString()}<br>` +
        `ตำแหน่ง: #${p.semanticRank.toLocaleString()}<extra></extra>`,
    ),
    marker: {
      color: items.map((p) => p.color),
      size: 4,
      opacity: 0.75,
    },
  });

  const pcaItems = points.filter((p) => p.pc1 !== null && p.pc2 !== null);
  const pcaTrace = {
    type: "scattergl",
    mode: "markers",
    name: "GloVe PCA",
    x: pcaItems.map((p) => p.pc1),
    y: pcaItems.map((p) => p.pc2),
    text: pcaItems.map((p) => p.word),
    hovertemplate: pcaItems.map(
      (p) =>
        `<b>${escapeHtml(p.word)}</b><br>` +
        `ตำแหน่ง: #${p.semanticRank.toLocaleString()}<br>` +
        `GloVe: #${p.vocabRank.toLocaleString()}<extra></extra>`,
    ),
    marker: {
      color: pcaItems.map((p) => p.color),
      size: 4,
      opacity: 0.75,
    },
  };

  const payload = {
    secret,
    date,
    counts: {
      total: points.length,
      green: green.length,
      yellow: yellow.length,
      red: red.length,
    },
    traces: {
      rank: [trace(green, "เขียว ≤300"), trace(yellow, "ส้ม 301–1500"), trace(red, "แดง >1500")],
      pca: [pcaTrace],
    },
  };

  const langTag = config.lang === "th" ? "th" : "en";
  const title = config.lang === "th" ? "Contexto ไทย — ตำแหน่งคำเล่นได้" : "Contexto — ตำแหน่งคำเล่นได้";

  return `<!DOCTYPE html>
<html lang="${langTag}">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #0f1115; color: #e8eaed; }
    header { padding: 20px 24px 8px; }
    h1 { margin: 0 0 6px; font-size: 1.35rem; font-weight: 600; }
    p { margin: 0; color: #9aa0a6; font-size: 0.92rem; line-height: 1.5; }
    .stats { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px 24px 0; }
    .stat { background: #1a1d24; border: 1px solid #2a2f3a; border-radius: 8px; padding: 10px 14px; min-width: 120px; }
    .stat strong { display: block; font-size: 1.1rem; color: #fff; }
    .stat span { font-size: 0.8rem; color: #9aa0a6; }
    .plot { width: 100%; height: 520px; }
    .tabs { padding: 16px 24px 0; display: flex; gap: 8px; }
    button { background: #1a1d24; color: #e8eaed; border: 1px solid #2a2f3a; border-radius: 6px; padding: 8px 14px; cursor: pointer; }
    button.active { background: #2d5a3d; border-color: #3d7a52; }
  </style>
</head>
<body>
  <header>
    <h1>ตำแหน่งคำเล่นได้จาก ${escapeHtml(config.sourceLabel)}</h1>
    <p>คำลับ: <strong style="color:#fff">${escapeHtml(secret)}</strong> · วันที่ ${escapeHtml(date)} · คำที่เล่นได้ทั้งหมด ${payload.counts.total.toLocaleString()} คำ</p>
  </header>
  <div class="stats" id="stats"></div>
  <div class="tabs">
    <button id="tab-rank" class="active">GloVe rank vs ตำแหน่ง</button>
    <button id="tab-pca">GloVe PCA 2D</button>
  </div>
  <div id="plot-rank" class="plot"></div>
  <div id="plot-pca" class="plot" style="display:none"></div>
  <script>
    const DATA = ${JSON.stringify(payload)};

    document.getElementById("stats").innerHTML = [
      ["คำเล่นได้", DATA.counts.total],
      ["เขียว ≤300", DATA.counts.green],
      ["ส้ม 301–1500", DATA.counts.yellow],
      ["แดง >1500", DATA.counts.red],
    ].map(([label, value]) => \`<div class="stat"><strong>\${value.toLocaleString()}</strong><span>\${label}</span></div>\`).join("");

    const rankLayout = {
      paper_bgcolor: "#0f1115",
      plot_bgcolor: "#0f1115",
      font: { color: "#e8eaed" },
      title: { text: "อันดับ GloVe vs ตำแหน่งเชิงความหมาย", font: { size: 15 } },
      xaxis: { title: "อันดับใน GloVe (1 = พบบ่อยสุดใน corpus)", type: "log", gridcolor: "#2a2f3a" },
      yaxis: { title: "ตำแหน่งเชิงความหมาย (1 = ใกล้คำลับสุด)", type: "log", gridcolor: "#2a2f3a" },
      legend: { orientation: "h", y: 1.12 },
      margin: { t: 70, r: 20, b: 60, l: 70 },
    };

    const pcaLayout = {
      paper_bgcolor: "#0f1115",
      plot_bgcolor: "#0f1115",
      font: { color: "#e8eaed" },
      title: { text: "GloVe 300d → PCA 2 มิติ (สี = ตำแหน่งเชิงความหมาย)", font: { size: 15 } },
      xaxis: { title: "PC1", gridcolor: "#2a2f3a" },
      yaxis: { title: "PC2", gridcolor: "#2a2f3a" },
      legend: { orientation: "h", y: 1.12 },
      margin: { t: 70, r: 20, b: 60, l: 70 },
    };

    Plotly.newPlot("plot-rank", DATA.traces.rank, rankLayout, { responsive: true, displayModeBar: true });
    Plotly.newPlot("plot-pca", DATA.traces.pca, pcaLayout, { responsive: true, displayModeBar: true });

    const tabRank = document.getElementById("tab-rank");
    const tabPca = document.getElementById("tab-pca");
    const plotRank = document.getElementById("plot-rank");
    const plotPca = document.getElementById("plot-pca");

    tabRank.onclick = () => {
      tabRank.classList.add("active");
      tabPca.classList.remove("active");
      plotRank.style.display = "block";
      plotPca.style.display = "none";
      Plotly.Plots.resize(plotRank);
    };
    tabPca.onclick = () => {
      tabPca.classList.add("active");
      tabRank.classList.remove("active");
      plotPca.style.display = "block";
      plotRank.style.display = "none";
      Plotly.Plots.resize(plotPca);
    };
  </script>
</body>
</html>`;
}

async function main() {
  const lang: GameLang = process.env.LANGUAGE === "th" ? "th" : "en";
  const config = CONFIG[lang];
  const date = process.env.DATE ?? new Date().toISOString().slice(0, 10);
  const secretOverride = process.env.SECRET;

  console.log(`[${lang}] Loading playable vocabulary...`);
  const vocabulary = loadPlayableWords(lang);
  if (vocabulary.length < 1000) {
    throw new Error(`Vocabulary too small (${vocabulary.length}). ${config.buildVocabHint}`);
  }
  console.log(`  ${vocabulary.length.toLocaleString()} playable words`);

  const meta = readSeedMeta(lang);
  if (!meta) throw new Error(config.seedHint);

  const puzzle = getOrCreateDailyPuzzle(date, lang);
  const secret = secretOverride ?? puzzle.secret;
  console.log(`Computing semantic ranks vs secret "${secret}" (${date})...`);
  const ranks = await rankAllWords(secret, lang);

  console.log("Loading vectors for PCA...");
  const table = await getWordsTable(lang);
  const rows = await table.query().select(["word", "vector"]).limit(meta.vocabSize).toArray();
  const vectorByWord = new Map<string, number[]>();
  for (const row of rows) {
    const vector = toNumberArray(row.vector);
    if (vector) vectorByWord.set(row.word as string, vector);
  }

  const vocabWords: string[] = [];
  const vocabVectors: number[][] = [];
  for (const entry of vocabulary) {
    const vector = vectorByWord.get(entry.word);
    if (vector) {
      vocabWords.push(entry.word);
      vocabVectors.push(vector);
    }
  }
  console.log(`  ${vocabWords.length.toLocaleString()} words have vectors`);
  console.log("Running PCA (this may take a minute)...");
  const { pc1, pc2 } = pca2(vocabVectors);
  const pcaByWord = new Map<string, { pc1: number; pc2: number }>();
  vocabWords.forEach((word, i) => {
    pcaByWord.set(word, { pc1: pc1[i], pc2: pc2[i] });
  });

  const missing: string[] = [];
  const points: PlotPoint[] = [];
  for (const entry of vocabulary) {
    const semanticRank = ranks.get(entry.word);
    if (semanticRank === undefined) {
      missing.push(entry.word);
      continue;
    }
    const zone = rankZone(semanticRank);
    const pca = pcaByWord.get(entry.word);
    points.push({
      word: entry.word,
      vocabRank: entry.vocabRank,
      semanticRank,
      zone,
      color: rankToColor(semanticRank),
      pc1: pca?.pc1 ?? null,
      pc2: pca?.pc2 ?? null,
    });
  }

  if (missing.length > 0) {
    console.warn(`  Warning: ${missing.length} vocab words missing from LanceDB (re-run seed?)`);
  }

  const outDir = path.join(process.cwd(), "output", lang);
  fs.mkdirSync(outDir, { recursive: true });

  const csvPath = path.join(outDir, "word-positions.csv");
  const csvLines = [
    "word,vocab_rank,semantic_rank,zone,pc1,pc2",
    ...points.map(
      (p) => `${p.word},${p.vocabRank},${p.semanticRank},${p.zone},${p.pc1 ?? ""},${p.pc2 ?? ""}`,
    ),
  ];
  fs.writeFileSync(csvPath, csvLines.join("\n"));

  const htmlPath = path.join(outDir, "word-positions.html");
  fs.writeFileSync(htmlPath, buildHtml(config, secret, date, points));

  console.log(`\nDone!`);
  console.log(`  HTML: ${htmlPath}`);
  console.log(`  CSV:  ${csvPath}`);
  console.log(`  ${points.length.toLocaleString()} words plotted`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
