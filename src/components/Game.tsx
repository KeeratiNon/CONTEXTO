"use client";

import { GuessBar } from "@/components/GuessBar";
import {
  ConfirmGiveUp,
  GaveUpModal,
  HowToPlay,
  Menu,
  WinModal,
} from "@/components/Modals";
import { cluesMatchLang, langFromPuzzleId } from "@/lib/lang";
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
  clues?: string[];
  plannedClues?: string[];
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
  const [clues, setClues] = useState<string[]>([]);
  const [plannedClues, setPlannedClues] = useState<string[]>([]);
  const [hintBusy, setHintBusy] = useState(false);
  const [hintsPreparing, setHintsPreparing] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [flashWord, setFlashWord] = useState<string | null>(null);
  const [pendingWord, setPendingWord] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const over = won || gaveUp;
  const t = COPY[lang];
  const hintsUsed = clues.length;
  const hintsLeft = Math.max(0, MAX_HINTS - hintsUsed);
  const hintsReady = plannedClues.length === MAX_HINTS;
  const bootLoading =
    loadingPuzzle ||
    ((hintsPreparing || !hintsReady) && !over && !notSeeded && !error);
  const hintDisabled =
    over || busy || hintBusy || !puzzle || hintsLeft <= 0 || hintsPreparing;
  const lastGuess = guesses[guesses.length - 1] ?? null;
  const sortedGuesses = useMemo(
    () => [...guesses].sort((a, b) => a.rank - b.rank),
    [guesses],
  );

  const persist = useCallback(
    (next: Partial<SaveState> & { puzzleId: string; guesses: Guess[] }) => {
      const prev = readSave(next.puzzleId);
      writeSave({
        puzzleId: next.puzzleId,
        guesses: next.guesses,
        won: next.won ?? false,
        gaveUp: next.gaveUp ?? false,
        secret: next.secret,
        clues: next.clues ?? prev?.clues,
        plannedClues: next.plannedClues ?? prev?.plannedClues,
      });
    },
    [],
  );

  const ensureHints = useCallback(async (puzzleId: string) => {
    setHintsPreparing(true);
    try {
      const response = await fetch("/api/hint/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || t.hintsNotReady);
        return false;
      }
      if (Array.isArray(data.planned) && data.planned.length === MAX_HINTS) {
        setPlannedClues(data.planned);
        const saved = readSave(puzzleId);
        if (saved) {
          const keepClues =
            saved.clues &&
            cluesMatchLang(saved.clues, langFromPuzzleId(puzzleId))
              ? saved.clues
              : [];
          writeSave({ ...saved, plannedClues: data.planned, clues: keepClues });
        }
        setError("");
        return true;
      }
      setError(t.hintsNotReady);
      return false;
    } catch {
      setError(t.networkError);
      return false;
    } finally {
      setHintsPreparing(false);
    }
  }, [t.hintsNotReady, t.networkError]);

  const loadPuzzle = useCallback(async (nextMode: "daily" | "unlimited", nextLang: GameLang) => {
    setLoadingPuzzle(true);
    setHintsPreparing(false);
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
      const puzzleLang = meta.lang ?? nextLang;
      const serverPlanned =
        meta.plannedClues?.length === MAX_HINTS &&
        cluesMatchLang(meta.plannedClues, puzzleLang)
          ? meta.plannedClues
          : [];
      const savedPlanned =
        saved?.plannedClues?.length === MAX_HINTS &&
        cluesMatchLang(saved.plannedClues, puzzleLang)
          ? saved.plannedClues
          : [];
      const planned = serverPlanned.length ? serverPlanned : savedPlanned;
      const alreadyOver = Boolean(saved?.won || saved?.gaveUp);
      const savedClues =
        saved?.clues?.length && cluesMatchLang(saved.clues, puzzleLang)
          ? saved.clues
          : [];
      if (saved && saved.puzzleId === meta.id) {
        setGuesses(saved.guesses);
        setWon(saved.won);
        setGaveUp(saved.gaveUp);
        setSecret(saved.secret ?? null);
        setClues(savedClues);
        setPlannedClues(planned);
        if (saved.won) setModal("win");
      } else {
        setGuesses([]);
        setWon(false);
        setGaveUp(false);
        setSecret(null);
        setClues([]);
        setPlannedClues(planned);
      }

      if (!alreadyOver && planned.length !== MAX_HINTS) {
        setHintsPreparing(true);
        await ensureHints(meta.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load puzzle");
    } finally {
      setLoadingPuzzle(false);
    }
  }, [ensureHints]);

  useEffect(() => {
    if (!puzzle || over || hintsPreparing) return;
    const puzzleLang = puzzle.lang ?? lang;
    const plannedBad =
      plannedClues.length > 0 && !cluesMatchLang(plannedClues, puzzleLang);
    const cluesBad = clues.length > 0 && !cluesMatchLang(clues, puzzleLang);
    if (!plannedBad && !cluesBad) return;
    setClues([]);
    setPlannedClues([]);
    void ensureHints(puzzle.id);
  }, [puzzle, lang, over, hintsPreparing, plannedClues, clues, ensureHints]);

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
    // Mount-only: loadPuzzle identity changes with copy/lang and would refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setClues([]);
    setPlannedClues([]);
    await loadPuzzle(mode, nextLang);
  }

  async function sendGuess(word: string) {
    if (!puzzle || over) return;
    if (busy) return;
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
          clues,
          plannedClues,
        });
      } else {
        persist({ puzzleId: puzzle.id, guesses: nextGuesses, clues, plannedClues });
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
    if (!puzzle || over || busy || hintBusy || hintsLeft <= 0 || hintsPreparing) return;
    if (!hintsReady) {
      void ensureHints(puzzle.id);
      return;
    }
    setModal(null);
    setHintBusy(true);
    setError("");
    try {
      const response = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId: puzzle.id,
          hintsUsed,
          guessed: guesses.map((guess) => guess.word),
          revealed: clues,
          planned: plannedClues,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || (lang === "th" ? "ไม่มีคำใบ้" : "No hint available."));
        return;
      }
      const nextClues: string[] = Array.isArray(data.clues)
        ? data.clues
        : [...clues, data.clue].filter(Boolean);
      const nextPlanned: string[] = Array.isArray(data.planned)
        ? data.planned
        : plannedClues;
      setClues(nextClues);
      setPlannedClues(nextPlanned);
      persist({
        puzzleId: puzzle.id,
        guesses,
        won,
        gaveUp,
        secret: secret ?? undefined,
        clues: nextClues,
        plannedClues: nextPlanned,
      });
    } catch {
      setError(t.networkError);
    } finally {
      setHintBusy(false);
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
        clues,
        plannedClues,
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
          disabled={bootLoading}
        >
          ☰
        </button>
        <div className="brand">
          <h1>Contexto</h1>
          <p>
            {puzzle?.gameNumber ? `Game #${puzzle.gameNumber}` : t.unlimited}
            {!bootLoading ? (
              <>
                <span className="dot">·</span>
                {t.guesses}: {guesses.length}
              </>
            ) : null}
          </p>
        </div>
        <div className="header-right">
          <div className="lang-switch" role="group" aria-label="Language">
            <button
              className={lang === "en" ? "active" : ""}
              onClick={() => void switchLang("en")}
              disabled={bootLoading}
            >
              EN
            </button>
            <button
              className={lang === "th" ? "active" : ""}
              onClick={() => void switchLang("th")}
              disabled={bootLoading}
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

      {notSeeded ? (
        <div className="banner">
          <strong>{t.notSeededTitle}</strong>
          <p>{t.notSeededBody}</p>
        </div>
      ) : bootLoading ? (
        <div className="boot-screen" aria-busy="true" aria-live="polite">
          <div className="boot-orb" />
          <p className="boot-title">
            {hintsPreparing && !loadingPuzzle ? t.thinkingHint : t.preparingGame}
          </p>
        </div>
      ) : !hintsReady && !over ? (
        <div className="boot-screen">
          <p className="boot-title">{error || t.hintsNotReady}</p>
          <button
            className="btn primary"
            onClick={() => puzzle && void ensureHints(puzzle.id)}
            disabled={!puzzle || hintsPreparing}
          >
            {t.retryHints}
          </button>
        </div>
      ) : (
        <>
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

          {clues.length ? (
            <section className="clue-rail" aria-label={t.hintLabel}>
              {clues.map((clue, index) => (
                <div key={`${index}-${clue}`} className="clue-chip">
                  <span className="clue-n">
                    {t.hintLabel} {index + 1}
                  </span>
                  <span className="clue-text">{clue}</span>
                </div>
              ))}
            </section>
          ) : null}

          <div className="actions">
            {over ? (
              <>
                <button
                  onClick={() => setModal(won ? "win" : "gaveup")}
                  disabled={!won && !secret}
                >
                  {t.viewResults}
                </button>
                <button
                  className="play-again"
                  onClick={() => void switchMode("unlimited", true)}
                  disabled={busy || loadingPuzzle}
                >
                  {t.playAgain}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => void onHint()} disabled={hintDisabled}>
                  {!hintsReady
                    ? hintsPreparing
                      ? t.thinkingHint
                      : t.retryHints
                    : `${t.hint} · ${hintsLeft}`}
                </button>
                <button
                  onClick={() => setModal("confirm-giveup")}
                  disabled={busy || !puzzle}
                >
                  {t.giveUp}
                </button>
              </>
            )}
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

          {hintsPreparing && !clues.length ? (
            <p className="calculating" aria-live="polite">
              {t.thinkingHint}
            </p>
          ) : hintBusy || pendingWord !== null ? (
            <p className="calculating" aria-live="polite">
              {hintBusy ? t.thinkingHint : t.calculating}
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
        </>
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
      {modal === "menu" && !bootLoading && hintsReady ? (
        <Menu
          lang={lang}
          dark={dark}
          disabled={over || busy || !puzzle}
          hintDisabled={hintDisabled}
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
        />
      ) : null}
      {modal === "gaveup" && secret ? (
        <GaveUpModal
          lang={lang}
          secret={secret}
          onClose={() => setModal(null)}
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
