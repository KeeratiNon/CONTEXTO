import fs from "node:fs";
import path from "node:path";
import wordnet from "wordnet-db";
import {
  FREQUENCY_PATH,
  RAW_DIR,
  SECRETS_PATH,
  VOCAB_META_PATH,
  VOCAB_PATH,
} from "../src/lib/paths";
import {
  GLOVE_GUESS_MAX_LEN,
  GLOVE_GUESS_MIN_LEN,
  GLOVE_GUESS_TARGET,
  GLOVE_MODEL,
  listGloveGuessableWords,
} from "../src/lib/glove";
import { isSimpleWord, normalizeWord } from "../src/lib/words";

const FREQUENCY_URL =
  "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt";

const MIN_LEN = 3;
const MAX_LEN = 12;
const SECRET_MIN_RANK = 150;
const SECRET_MAX_RANK = 7000;
const SECRET_MIN_LEN = 3;
const SECRET_MAX_LEN = 10;
const SECRET_TARGET = 400;

const ABSTRACT_SUFFIXES = [
  "tion",
  "sion",
  "ness",
  "ment",
  "ity",
  "ism",
  "ology",
  "able",
  "ible",
  "ance",
  "ence",
];

const SECRET_BLOCKLIST = new Set([
  "thing",
  "stuff",
  "someone",
  "something",
  "anything",
  "nothing",
  "everything",
  "everybody",
  "nobody",
  "anyone",
  "people",
  "person",
  "lot",
  "bit",
  "kind",
  "sort",
  "part",
  "fact",
  "example",
  "number",
  "amount",
  "others",
  "whatever",
  "type",
  "case",
  "way",
  "ways",
  "sake",
  "dude",
  "buddy",
  "idiot",
  "fool",
  "jerk",
  "moron",
  "bastard",
  "bitch",
  "shit",
  "crap",
  "hell",
  "ass",
  "asshole",
  "arse",
  "damn",
  "dick",
  "prick",
  "cock",
  "bugger",
  "rape",
  "slut",
  "whore",
  "porn",
  "john",
  "jack",
  "jesus",
  "christ",
  "york",
  "mama",
  "sweetie",
  "honey",
  "till",
  "worth",
  "closer",
  "stole",
  "chosen",
  "folks",
  "penis",
  "vagina",
  "sperm",
  "heroin",
  "cocaine",
  "marijuana",
  "porn",
  "sucker",
  "fanny",
  "chick",
  "granny",
  "superman",
  "batman",
  "honesty",
  "ordinary",
  "upside",
  "pinky",
  "cunt",
  "pussy",
  "nonsense",
  "drove",
  "spoke",
  "sang",
  "eats",
  "khan",
  "troy",
  "dale",
  "haven",
  "haha",
  "brat",
  "quid",
  "auto",
  "tore",
  "dug",
  "cos",
  "teeth",
  "feet",
  "men",
  "women",
  "mice",
  "geese",
]);

const COMPASS_WORDS = new Set(["north", "south", "east", "west"]);

const FIRST_NAMES = new Set([
  "adam", "alice", "amy", "anna", "annie", "arthur", "benny", "bill", "billy",
  "bob", "bobby", "brian", "carl", "carol", "charlie", "chris", "dan", "danny",
  "dave", "david", "dick", "don", "donald", "donna", "edward", "elizabeth",
  "emily", "emma", "eric", "erica", "frank", "fred", "george", "grace", "harry",
  "helen", "henry", "jack", "jake", "james", "jane", "jason", "jeff", "jenny",
  "jerry", "jim", "jimmy", "joe", "john", "johnny", "joseph", "julie", "kate",
  "kathy", "kelly", "kevin", "larry", "laura", "lisa", "lucy", "maggie", "maria",
  "mark", "martin", "mary", "matt", "mike", "nancy", "nick", "nicole", "paul",
  "peter", "phil", "rachel", "richard", "rick", "robert", "robin", "ron", "rose",
  "roy", "ruth", "ryan", "sam", "sarah", "scott", "simon", "steve", "steven",
  "susan", "ted", "terry", "thomas", "tim", "tom", "tommy", "tony", "tracy",
  "victor", "walter", "william", "hank", "warren", "graham", "heather", "murphy",
  "perry", "bailey", "charlotte", "turner", "collins", "benjamin", "veronica",
  "drake", "phoebe", "daphne", "phoenix", "piper", "cassie", "cole", "toby",
  "napoleon", "miller", "lincoln", "elvis", "sherlock", "jonah", "jasper",
  "brent", "mack", "laurel", "tucker", "stuart", "hart", "ben", "max", "mac",
  "ken", "leo", "ian", "ray", "guy", "jay", "kirk", "marc", "gene", "font",
]);

const PLURALIA_TANTUM = new Set([
  "glasses",
  "pants",
  "scissors",
  "shorts",
  "clothes",
  "stairs",
  "jeans",
  "trousers",
  "goggles",
]);

const NUMBER_WORDS = new Set([
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "dozen",
  "hundred",
  "thousand",
  "million",
  "zero",
  "first",
  "second",
  "third",
]);

const CALENDAR_WORDS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);

const ROLE_NOUNS = new Set([
  "actor",
  "actress",
  "agent",
  "artist",
  "athlete",
  "author",
  "baby",
  "boss",
  "boy",
  "brother",
  "captain",
  "chef",
  "child",
  "citizen",
  "clerk",
  "client",
  "coach",
  "cook",
  "cousin",
  "customer",
  "dancer",
  "daughter",
  "detective",
  "doctor",
  "driver",
  "emperor",
  "farmer",
  "father",
  "friend",
  "girl",
  "guest",
  "guide",
  "hero",
  "host",
  "husband",
  "judge",
  "kid",
  "king",
  "knight",
  "lady",
  "lawyer",
  "leader",
  "maid",
  "man",
  "manager",
  "mother",
  "musician",
  "neighbor",
  "neighbour",
  "nurse",
  "officer",
  "patient",
  "pilot",
  "player",
  "poet",
  "police",
  "priest",
  "prince",
  "princess",
  "prisoner",
  "queen",
  "sailor",
  "scientist",
  "scout",
  "secretary",
  "sheriff",
  "singer",
  "sister",
  "soldier",
  "son",
  "student",
  "teacher",
  "thief",
  "uncle",
  "victim",
  "waiter",
  "wife",
  "witch",
  "wizard",
  "woman",
  "worker",
  "writer",
]);

const CONCRETE_LEX = new Set([
  5, 6, 8, 11, 13, 14, 15, 17, 18, 19, 20, 21, 25, 27,
]);

const PREFERRED_LEX = new Set([5, 6, 8, 13, 15, 17, 20, 27]);

const OCCUPATION_SUFFIX = /(?:er|or|ist|ian|ant|ent|man|woman|eer|ess)$/;

type FreqEntry = { word: string; rank: number; count: number };
type LemmaIndex = { lemmas: Set<string>; senses: Map<string, number> };

function parseIndex(file: string): LemmaIndex {
  const lemmas = new Set<string>();
  const senses = new Map<string, number>();
  const text = fs.readFileSync(path.join(wordnet.path, file), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith(" ")) continue;
    const parts = line.split(" ");
    const lemma = parts[0];
    if (!lemma || lemma.includes("_")) continue;
    const word = normalizeWord(lemma);
    if (!/^[a-z]{3,14}$/.test(word)) continue;
    const synsetCount = Number(parts[2]) || 0;
    lemmas.add(word);
    senses.set(word, (senses.get(word) ?? 0) + synsetCount);
  }
  return { lemmas, senses };
}

function parseNounData(): {
  lex: Map<string, Set<number>>;
  properOnly: Set<string>;
  capitalizedOnly: Set<string>;
  mostlyProper: Set<string>;
} {
  const lex = new Map<string, Set<number>>();
  const synsetTotal = new Map<string, number>();
  const instanceTotal = new Map<string, number>();
  const capTotal = new Map<string, number>();
  const text = fs.readFileSync(path.join(wordnet.path, "data.noun"), "utf8");

  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith(" ")) continue;
    const header = line.split(" | ")[0] ?? line;
    const parts = header.split(" ");
    if (parts.length < 5) continue;
    const lexFile = Number(parts[1]);
    const wordCount = parseInt(parts[3] ?? "0", 16);
    if (!Number.isFinite(lexFile) || !Number.isFinite(wordCount)) continue;

    const lemmas: Array<{ word: string; capitalized: boolean }> = [];
    let cursor = 4;
    for (let i = 0; i < wordCount; i += 1) {
      const lemma = parts[cursor] ?? "";
      cursor += 2;
      if (!lemma || lemma.includes("_")) continue;
      const raw = lemma.replace(/\(.+\)$/, "");
      const word = normalizeWord(raw);
      if (!/^[a-z]{3,14}$/.test(word)) continue;
      lemmas.push({ word, capitalized: /^[A-Z]/.test(raw) });
      const current = lex.get(word) ?? new Set<number>();
      current.add(lexFile);
      lex.set(word, current);
    }

    const pointerCount = Number(parts[cursor] ?? 0);
    cursor += 1;
    let isInstance = false;
    for (let i = 0; i < pointerCount; i += 1) {
      if (parts[cursor] === "@i") isInstance = true;
      cursor += 4;
    }

    for (const { word, capitalized } of lemmas) {
      synsetTotal.set(word, (synsetTotal.get(word) ?? 0) + 1);
      if (isInstance) instanceTotal.set(word, (instanceTotal.get(word) ?? 0) + 1);
      if (capitalized) capTotal.set(word, (capTotal.get(word) ?? 0) + 1);
    }
  }

  const properOnly = new Set<string>();
  const capitalizedOnly = new Set<string>();
  const mostlyProper = new Set<string>();
  for (const [word, total] of synsetTotal) {
    const caps = capTotal.get(word) ?? 0;
    if (total > 0 && (instanceTotal.get(word) ?? 0) === total) properOnly.add(word);
    if (total > 0 && caps === total) capitalizedOnly.add(word);
    if (caps > 0 && caps * 2 >= total) mostlyProper.add(word);
  }
  return { lex, properOnly, capitalizedOnly, mostlyProper };
}

function looksAbstract(word: string): boolean {
  return ABSTRACT_SUFFIXES.some(
    (suffix) => word.endsWith(suffix) && word.length > suffix.length + 3,
  );
}

function isRegularPlural(word: string, nouns: Set<string>): boolean {
  if (PLURALIA_TANTUM.has(word)) return false;
  if (word.endsWith("ss") || word.endsWith("us") || word.endsWith("is")) return false;
  if (word.endsWith("ies") && word.length > 4 && nouns.has(`${word.slice(0, -3)}y`)) {
    return true;
  }
  if (word.endsWith("es") && word.length > 4 && nouns.has(word.slice(0, -2))) return true;
  if (word.endsWith("s") && word.length > 3 && nouns.has(word.slice(0, -1))) return true;
  return false;
}

function isRoleNoun(word: string, lex: Set<number>): boolean {
  if (ROLE_NOUNS.has(word) || OCCUPATION_SUFFIX.test(word)) return true;
  return [...lex].some((id) => id !== 18 && CONCRETE_LEX.has(id));
}

function isSecretNoun(
  word: string,
  rank: number,
  nouns: Set<string>,
  nounSenses: Map<string, number>,
  verbSenses: Map<string, number>,
  adjSenses: Map<string, number>,
  advSenses: Map<string, number>,
  nounLex: Map<string, Set<number>>,
  properOnly: Set<string>,
  capitalizedOnly: Set<string>,
  mostlyProper: Set<string>,
): boolean {
  if (!nouns.has(word) || !isSimpleWord(word)) return false;
  if (rank < SECRET_MIN_RANK || rank > SECRET_MAX_RANK) return false;
  if (word.length < SECRET_MIN_LEN || word.length > SECRET_MAX_LEN) return false;
  if (
    SECRET_BLOCKLIST.has(word) ||
    FIRST_NAMES.has(word) ||
    NUMBER_WORDS.has(word) ||
    CALENDAR_WORDS.has(word) ||
    COMPASS_WORDS.has(word) ||
    looksAbstract(word)
  ) {
    return false;
  }
  if (properOnly.has(word) || capitalizedOnly.has(word)) return false;
  const objectyPreview = [...(nounLex.get(word) ?? new Set<number>())].some((id) =>
    [5, 6, 8, 13, 17, 20, 27].includes(id),
  );
  if (mostlyProper.has(word) && !objectyPreview) return false;
  if (isRegularPlural(word, nouns)) return false;

  const n = nounSenses.get(word) ?? 0;
  const v = verbSenses.get(word) ?? 0;
  const a = adjSenses.get(word) ?? 0;
  const r = advSenses.get(word) ?? 0;
  if (n <= 0) return false;
  if (a >= n) return false;
  if (r >= n) return false;
  const lex = nounLex.get(word);
  if (!lex) return false;
  const objecty = [...lex].some((id) => [5, 6, 8, 13, 17, 20, 27].includes(id));
  const location = lex.has(15);
  const role = isRoleNoun(word, lex);
  if (!objecty && !location && !role) return false;
  if (v > n && !(objecty && v <= n + 2)) return false;
  if (v > n * 2) return false;
  if (a > 0 && !objecty) return false;
  return true;
}

function secretScore(
  word: string,
  rank: number,
  verbSenses: Map<string, number>,
  adjSenses: Map<string, number>,
  advSenses: Map<string, number>,
  nounLex: Map<string, Set<number>>,
): number {
  const v = verbSenses.get(word) ?? 0;
  const a = adjSenses.get(word) ?? 0;
  const r = advSenses.get(word) ?? 0;
  const lex = nounLex.get(word) ?? new Set<number>();
  const objecty = [...lex].some((id) => [5, 6, 8, 13, 17, 20, 27].includes(id));
  const role = ROLE_NOUNS.has(word);
  let score = 0;
  if (objecty) score += 5;
  if (role) score += 4;
  if (v <= 2 && a === 0 && r === 0) score += 3;
  else if (v === 0) score += 1;
  if ([...lex].every((id) => id === 18)) score -= 1;
  if (rank >= 200 && rank <= 1800) score += 5;
  else if (rank >= 200 && rank <= 4000) score += 3;
  else if (rank >= 150 && rank <= 6000) score += 1;
  if (word.length >= 3 && word.length <= 8) score += 1;
  return score;
}

async function loadFrequencyList(): Promise<FreqEntry[]> {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  if (!fs.existsSync(FREQUENCY_PATH)) {
    console.log(`Downloading frequency list → ${FREQUENCY_PATH}`);
    const response = await fetch(FREQUENCY_URL);
    if (!response.ok) {
      throw new Error(`Failed to download frequency list: ${response.status} ${response.statusText}`);
    }
    fs.writeFileSync(FREQUENCY_PATH, await response.text());
  }

  const entries: FreqEntry[] = [];
  const seen = new Set<string>();
  for (const line of fs.readFileSync(FREQUENCY_PATH, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [raw, countText] = line.split(/\s+/);
    const word = normalizeWord(raw ?? "");
    if (!/^[a-z]+$/.test(word) || word.length < MIN_LEN || word.length > MAX_LEN) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    entries.push({
      word,
      rank: entries.length + 1,
      count: Number(countText) || 0,
    });
  }
  return entries;
}

function pickSecrets(
  candidates: Array<{ word: string; rank: number; score: number; kind: "object" | "role" }>,
): string[] {
  const unique = [...new Map(candidates.map((item) => [item.word, item])).values()];
  const byQuality = (a: (typeof unique)[number], b: (typeof unique)[number]) =>
    b.score - a.score || Math.abs(a.rank - 1500) - Math.abs(b.rank - 1500);
  const objects = unique.filter((item) => item.kind === "object").sort(byQuality).slice(0, 320);
  const roles = unique.filter((item) => item.kind === "role").sort(byQuality).slice(0, 80);
  return [...objects, ...roles].map((item) => item.word);
}

async function main() {
  console.log("Building Contexto-style vocabulary...");
  console.log(`Guessable set: first ${GLOVE_GUESS_TARGET.toLocaleString()} GloVe ${GLOVE_MODEL} tokens`);
  const nouns = parseIndex("index.noun");
  const verbs = parseIndex("index.verb");
  const adjectives = parseIndex("index.adj");
  const adverbs = parseIndex("index.adv");
  const { lex: nounLex, properOnly, capitalizedOnly, mostlyProper } = parseNounData();
  const frequency = await loadFrequencyList();
  const freqRank = new Map(frequency.map((entry) => [entry.word, entry.rank]));

  const gloveWords = await listGloveGuessableWords(GLOVE_GUESS_TARGET);
  if (gloveWords.length < 1000) {
    throw new Error(`GloVe guessable list too small (${gloveWords.length}). Check ${GLOVE_MODEL}.`);
  }
  const vocab = new Set(gloveWords);

  const secretCandidates = [...freqRank.entries()]
    .filter(([word, rank]) =>
      vocab.has(word) &&
      isSecretNoun(
        word,
        rank,
        nouns.lemmas,
        nouns.senses,
        verbs.senses,
        adjectives.senses,
        adverbs.senses,
        nounLex,
        properOnly,
        capitalizedOnly,
        mostlyProper,
      ),
    )
    .map(([word, rank]) => {
      const lex = nounLex.get(word) ?? new Set<number>();
      const role =
        ROLE_NOUNS.has(word) || [...lex].every((id) => id === 18);
      return {
        word,
        rank,
        score: secretScore(word, rank, verbs.senses, adjectives.senses, adverbs.senses, nounLex),
        kind: role ? ("role" as const) : ("object" as const),
      };
    });

  const secrets = pickSecrets(secretCandidates);
  for (const secret of secrets) vocab.add(secret);
  const words = [...vocab].sort();

  fs.writeFileSync(VOCAB_PATH, `${words.join("\n")}\n`);
  fs.writeFileSync(SECRETS_PATH, `${secrets.join("\n")}\n`);
  fs.writeFileSync(
    VOCAB_META_PATH,
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        sources: [
          {
            name: "GloVe",
            model: GLOVE_MODEL,
            url: "https://nlp.stanford.edu/projects/glove/",
            note: "frequency-sorted 6B tokens; alphabetic English-like head",
          },
          {
            name: "OpenSubtitles FrequencyWords",
            url: FREQUENCY_URL,
            year: 2018,
            file: "en_50k.txt",
            usedFor: "secret noun ranking",
          },
          {
            name: "Princeton WordNet",
            version: wordnet.version,
            package: "wordnet-db",
            usedFor: "secret noun filter",
          },
        ],
        rules: {
          guessMinLen: GLOVE_GUESS_MIN_LEN,
          guessMaxLen: GLOVE_GUESS_MAX_LEN,
          guessTarget: GLOVE_GUESS_TARGET,
          guesses: "first 70k alphabetic GloVe 6B tokens (skip no-vowel / triple-letter junk)",
          secrets: "everyday concrete nouns; skip verb/adjective-dominant and proper names",
          secretMinFrequencyRank: SECRET_MIN_RANK,
          secretMaxFrequencyRank: SECRET_MAX_RANK,
          secretCandidates: secretCandidates.length,
        },
        counts: {
          wordnetNouns: nouns.lemmas.size,
          wordnetVerbs: verbs.lemmas.size,
          frequencyEntries: frequency.length,
          gloveHead: gloveWords.length,
          vocabulary: words.length,
          secrets: secrets.length,
        },
      },
      null,
      2,
    ),
  );

  console.log(`Guessable words: ${words.length} (GloVe ${GLOVE_MODEL} frequency head)`);
  console.log(`Secret candidates: ${secretCandidates.length}`);
  console.log(`Secret nouns: ${secrets.length}`);
  console.log("Next: npm run seed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
