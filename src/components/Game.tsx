"use client";

import { GuessBar } from "@/components/GuessBar";
import {
  ConfirmGiveUp,
  GaveUpModal,
  HowToPlay,
  Menu,
  WinModal,
} from "@/components/Modals";
import { MAX_HINTS, type GameLang, type Guess, type PuzzleMeta } from "@/lib/types";
import { COPY } from "@/lib/copy";
import { todayDate } from "@/lib/date";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type SaveState = {
  puzzleId: string;
  guesses: Guess[];
  won: boolean;
  gaveUp: boolean;
  secret?: string;
};

type Modal = "help" | "menu" | "win" | "gaveup" | "confirm-giveup" | null;

const THEME_KEY = "contexto-theme";
const HELP_KEY = "contexto-seen-help";
const LANG_KEY = "contexto-lang";

function saveKey(puzzleId: string) {
  return `contexto-save:${puzzleId}`;
}

function readSave(puzzleId: string): SaveState | null {
  try {
    const raw = localStorage.getItem(saveKey(puzzleId));
    return raw ? (JSON.parse(raw) as SaveState) : null;
  } catch {
    return null;
  }
}

function writeSave(state: SaveState) {
  localStorage.setItem(saveKey(state.puzzleId), JSON.stringify(state));
}

export function Game() {
  const [dark, setDark] = useState(false);
  const [lang, setLang] = useState<GameLang>("en");
  const [mode, setMode] = useState<"daily" | "unlimited">("daily");
  const [puzzle, setPuzzle] = useState<PuzzleMeta | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingPuzzle, setLoadingPuzzle] = useState(true);
  const [notSeeded, setNotSeeded] = useState(false);
  const [won, setWon] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [flashWord, setFlashWord] = useState<string | null>(null);
  const [pendingWord, setPendingWord] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const over = won || gaveUp;
  const t = COPY[lang];
  const hintsUsed = guesses.filter((guess) => guess.fromHint).length;
  const hintsLeft = Math.max(0, MAX_HINTS - hintsUsed);
  const lastGuess = guesses[guesses.length - 1] ?? null;
  const sortedGuesses = useMemo(
    () => [...guesses].sort((a, b) => a.rank - b.rank),
    [guesses],
  );

  const persist = useCallback(
    (next: Partial<SaveState> & { puzzleId: string; guesses: Guess[] }) => {
      writeSave({
        puzzleId: next.puzzleId,
        guesses: next.guesses,
        won: next.won ?? false,
        gaveUp: next.gaveUp ?? false,
        secret: next.secret,
      });
    },
    [],
  );

  const loadPuzzle = useCallback(async (nextMode: "daily" | "unlimited", nextLang: GameLang) => {
    setLoadingPuzzle(true);
    setError("");
    setNotSeeded(false);
    try {
      const response =
        nextMode === "unlimited"
          ? await fetch("/api/puzzle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "unlimited", lang: nextLang }),
            })
          : await fetch(`/api/puzzle?date=${todayDate()}&lang=${nextLang}`);

      const data = await response.json();
      if (!response.ok) {
        if (data.error === "not_seeded") setNotSeeded(true);
        throw new Error(data.message || "Could not load puzzle");
      }

      const meta = data as PuzzleMeta;
      setPuzzle(meta);
      const saved = readSave(meta.id);
      if (saved && saved.puzzleId === meta.id) {
        setGuesses(saved.guesses);
        setWon(saved.won);
        setGaveUp(saved.gaveUp);
        setSecret(saved.secret ?? null);
        if (saved.won) setModal("win");
      } else {
        setGuesses([]);
        setWon(false);
        setGaveUp(false);
        setSecret(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load puzzle");
    } finally {
      setLoadingPuzzle(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const nextDark = stored === "dark";
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    const storedLang = localStorage.getItem(LANG_KEY) === "th" ? "th" : "en";
    setLang(storedLang);
    document.documentElement.lang = storedLang;
    document.documentElement.classList.toggle("lang-th", storedLang === "th");
    if (!localStorage.getItem(HELP_KEY)) setModal("help");
    void loadPuzzle("daily", storedLang);
  }, [loadPuzzle]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  }

  async function switchMode(nextMode: "daily" | "unlimited", force = false) {
    if (!force && nextMode === mode && puzzle) return;
    setMode(nextMode);
    setModal(null);
    await loadPuzzle(nextMode, lang);
  }

  async function switchLang(nextLang: GameLang) {
    if (nextLang === lang && puzzle) return;
    setLang(nextLang);
    localStorage.setItem(LANG_KEY, nextLang);
    document.documentElement.lang = nextLang;
    document.documentElement.classList.toggle("lang-th", nextLang === "th");
    setModal(null);
    setGuesses([]);
    setWon(false);
    setGaveUp(false);
    setSecret(null);
    await loadPuzzle(mode, nextLang);
  }

  async function sendGuess(word: string, fromHint = false) {
    if (!puzzle || over) return;
    if (busy && !fromHint) return;
    const trimmed = lang === "th" ? word.trim() : word.trim().toLowerCase();
    if (!trimmed) return;

    const existing = guesses.find((guess) => guess.word === trimmed);
    if (existing) {
      setError(t.alreadyGuessed);
      setFlashWord(existing.word);
      inputRef.current?.focus();
      return;
    }

    setBusy(true);
    setError("");
    setPendingWord(trimmed);
    setInput("");
    try {
      const response = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.id, word: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPendingWord(null);
        setError(data.message || t.unknownWord);
        return;
      }

      const guess: Guess = {
        word: data.word,
        rank: data.rank,
        fromHint,
      };
      const nextGuesses = [...guesses, guess];
      setPendingWord(null);
      setGuesses(nextGuesses);
      setFlashWord(guess.word);

      if (data.correct) {
        setWon(true);
        setSecret(data.secret);
        setModal("win");
        persist({
          puzzleId: puzzle.id,
          guesses: nextGuesses,
          won: true,
          secret: data.secret,
        });
      } else {
        persist({ puzzleId: puzzle.id, guesses: nextGuesses });
      }
    } catch {
      setPendingWord(null);
      setError(t.networkError);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await sendGuess(input);
    inputRef.current?.focus();
  }

  async function onHint() {
    if (!puzzle || over || busy || hintsLeft <= 0) return;
    setModal(null);
    setBusy(true);
    setError("");
    setPendingWord("");
    try {
      const response = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId: puzzle.id,
          guessed: guesses.map((guess) => guess.word),
          hintsUsed,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPendingWord(null);
        setError(data.message || (lang === "th" ? "ไม่มีคำใบ้" : "No hint available."));
        return;
      }
      setBusy(false);
      await sendGuess(data.word, true);
    } catch {
      setPendingWord(null);
      setError(t.networkError);
    } finally {
      setBusy(false);
    }
  }

  async function onGiveUp() {
    if (!puzzle || over) return;
    setBusy(true);
    try {
      const response = await fetch("/api/give-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || (lang === "th" ? "เฉลยไม่ได้" : "Could not reveal the word."));
        return;
      }
      const revealed: Guess = { word: data.secret, rank: 1 };
      const nextGuesses = guesses.some((guess) => guess.rank === 1)
        ? guesses
        : [...guesses, revealed];
      setGuesses(nextGuesses);
      setGaveUp(true);
      setSecret(data.secret);
      setModal("gaveup");
      persist({
        puzzleId: puzzle.id,
        guesses: nextGuesses,
        gaveUp: true,
        secret: data.secret,
      });
    } catch {
      setError(t.networkError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <button
          className="icon-btn"
          onClick={() => setModal("menu")}
          aria-label="Menu"
        >
          ☰
        </button>
        <div className="brand">
          <h1>Contexto</h1>
          <p>
            {puzzle?.gameNumber ? `Game #${puzzle.gameNumber}` : t.unlimited}
            <span className="dot">·</span>
            {t.guesses}: {guesses.length}
          </p>
        </div>
        <div className="header-right">
          <div className="lang-switch" role="group" aria-label="Language">
            <button
              className={lang === "en" ? "active" : ""}
              onClick={() => void switchLang("en")}
            >
              EN
            </button>
            <button
              className={lang === "th" ? "active" : ""}
              onClick={() => void switchLang("th")}
            >
              TH
            </button>
          </div>
          <button
            className="icon-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {dark ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={mode === "daily" ? "active" : ""}
          onClick={() => void switchMode("daily")}
        >
          {t.daily}
        </button>
        <button
          className={mode === "unlimited" ? "active" : ""}
          onClick={() => void switchMode("unlimited")}
        >
          {t.unlimited}
        </button>
      </nav>

      {notSeeded ? (
        <div className="banner">
          <strong>{t.notSeededTitle}</strong>
          <p>{t.notSeededBody}</p>
        </div>
      ) : null}

      <div className="actions">
        <button
          onClick={onHint}
          disabled={over || busy || !puzzle || hintsLeft <= 0}
        >
          {t.hint} · {hintsLeft}
        </button>
        <button
          onClick={() => setModal("confirm-giveup")}
          disabled={over || busy || !puzzle}
        >
          {t.giveUp}
        </button>
      </div>

      <form className="guess-form" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={over ? t.gameOver : t.typeWord}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          disabled={over || !puzzle}
          aria-label="Guess"
        />
        <button
          type="submit"
          disabled={over || busy || !puzzle || !input.trim()}
          onMouseDown={(event) => event.preventDefault()}
        >
          {t.enter}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : <p className="error spacer" />}

      {loadingPuzzle || pendingWord !== null ? (
        <p className="calculating" aria-live="polite">
          {t.calculating}
        </p>
      ) : lastGuess ? (
        <div className="latest-guess">
          <GuessBar
            guess={lastGuess}
            vocabSize={puzzle?.vocabSize ?? 70000}
            flash={lastGuess.word === flashWord}
          />
        </div>
      ) : null}

      {loadingPuzzle ? null : (
      <section className="guess-list" aria-live="polite">
        {sortedGuesses.map((guess) => (
          <GuessBar
            key={guess.word}
            guess={guess}
            vocabSize={puzzle?.vocabSize ?? 70000}
            current={guess.word === lastGuess?.word}
          />
        ))}
      </section>
      )}

      {modal === "help" ? (
        <HowToPlay
          lang={lang}
          onClose={() => {
            localStorage.setItem(HELP_KEY, "1");
            setModal(null);
          }}
        />
      ) : null}
      {modal === "menu" ? (
        <Menu
          lang={lang}
          dark={dark}
          disabled={over || busy || !puzzle}
          hintDisabled={over || busy || !puzzle || hintsLeft <= 0}
          hintsLeft={hintsLeft}
          onClose={() => setModal(null)}
          onHowTo={() => setModal("help")}
          onHint={() => void onHint()}
          onGiveUp={() => setModal("confirm-giveup")}
          onTheme={toggleTheme}
        />
      ) : null}
      {modal === "win" && puzzle ? (
        <WinModal
          puzzle={puzzle}
          guesses={guesses}
          onClose={() => setModal(null)}
          onUnlimited={() => void switchMode("unlimited", true)}
        />
      ) : null}
      {modal === "gaveup" && secret ? (
        <GaveUpModal
          lang={lang}
          secret={secret}
          onClose={() => setModal(null)}
          onUnlimited={() => void switchMode("unlimited", true)}
        />
      ) : null}
      {modal === "confirm-giveup" ? (
        <ConfirmGiveUp
          lang={lang}
          onClose={() => setModal(null)}
          onConfirm={() => {
            setModal(null);
            void onGiveUp();
          }}
        />
      ) : null}
    </div>
  );
}
