"use client";

import { GuessBar } from "@/components/GuessBar";
import {
  ConfirmGiveUp,
  GaveUpModal,
  HowToPlay,
  Menu,
  WinModal,
} from "@/components/Modals";
import { MAX_HINTS, type Guess, type PuzzleMeta } from "@/lib/types";
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
  const hintsUsed = guesses.filter((guess) => guess.fromHint).length;
  const hintsLeft = Math.max(0, MAX_HINTS - hintsUsed);
  const lastGuess = guesses[guesses.length - 1] ?? null;
  const sortedGuesses = useMemo(
    () => [...guesses].sort((a, b) => a.rank - b.rank),
    [guesses],
  );

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const next = stored === "dark";
    // Restore client-only UI from localStorage after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    if (!localStorage.getItem(HELP_KEY)) setModal("help");
  }, []);

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

  const loadPuzzle = useCallback(async (nextMode: "daily" | "unlimited") => {
    setLoadingPuzzle(true);
    setError("");
    setNotSeeded(false);
    try {
      const response =
        nextMode === "unlimited"
          ? await fetch("/api/puzzle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "unlimited" }),
            })
          : await fetch(`/api/puzzle?date=${todayDate()}`);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch daily puzzle on mount
    void loadPuzzle("daily");
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
    await loadPuzzle(nextMode);
  }

  async function sendGuess(word: string, fromHint = false) {
    if (!puzzle || over) return;
    if (busy && !fromHint) return;
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) return;

    const existing = guesses.find((guess) => guess.word === trimmed);
    if (existing) {
      setError("You already guessed this word.");
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
        setError(data.message || "I don't know this word.");
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
      setError("Network error. Try again.");
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
        setError(data.message || "No hint available.");
        return;
      }
      setBusy(false);
      await sendGuess(data.word, true);
    } catch {
      setPendingWord(null);
      setError("Network error. Try again.");
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
        setError(data.message || "Could not reveal the word.");
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
      setError("Network error. Try again.");
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
            {puzzle?.gameNumber ? `Game #${puzzle.gameNumber}` : "Unlimited"}
            <span className="dot">·</span>
            Guesses: {guesses.length}
          </p>
        </div>
        <button
          className="icon-btn"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {dark ? "☀" : "☾"}
        </button>
      </header>

      <nav className="tabs">
        <button
          className={mode === "daily" ? "active" : ""}
          onClick={() => void switchMode("daily")}
        >
          Daily game
        </button>
        <button
          className={mode === "unlimited" ? "active" : ""}
          onClick={() => void switchMode("unlimited")}
        >
          Unlimited
        </button>
      </nav>

      {notSeeded ? (
        <div className="banner">
          <strong>Database not seeded.</strong>
          <p>
            Run <code>npm run seed</code> then restart the dev server.
          </p>
        </div>
      ) : null}

      <div className="actions">
        <button
          onClick={onHint}
          disabled={over || busy || !puzzle || hintsLeft <= 0}
        >
          Hint · {hintsLeft} left
        </button>
        <button
          onClick={() => setModal("confirm-giveup")}
          disabled={over || busy || !puzzle}
        >
          Give up
        </button>
      </div>

      <form className="guess-form" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={over ? "Game over" : "Type a word"}
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
          Enter
        </button>
      </form>

      {error ? <p className="error">{error}</p> : <p className="error spacer" />}

      {loadingPuzzle || pendingWord !== null ? (
        <p className="calculating" aria-live="polite">
          calculating...
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
          onClose={() => {
            localStorage.setItem(HELP_KEY, "1");
            setModal(null);
          }}
        />
      ) : null}
      {modal === "menu" ? (
        <Menu
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
          secret={secret}
          onClose={() => setModal(null)}
          onUnlimited={() => void switchMode("unlimited", true)}
        />
      ) : null}
      {modal === "confirm-giveup" ? (
        <ConfirmGiveUp
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
