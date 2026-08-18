"use client";

import { rankEmoji, winCopy } from "@/lib/heat";
import type { Guess, PuzzleMeta } from "@/lib/types";
import type { ReactNode } from "react";

function Overlay({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <Overlay title="How to play" onClose={onClose}>
      <div className="prose">
        <p>Find the secret word. You have unlimited guesses.</p>
        <p>
          You can guess any common English word — nouns, verbs, adjectives, and
          more. The secret itself is usually an everyday noun.
        </p>
        <p>
          The words were sorted by an artificial intelligence algorithm according
          to how similar they were to the secret word.
        </p>
        <p>
          After submitting a word, you will see its position. The secret word is
          number <strong>1</strong>.
        </p>
        <p>
          The algorithm uses embeddings of how words appear in context, then
          ranks the whole vocabulary with a vector database.
        </p>
        <ul>
          <li>
            <span className="swatch green" /> Green: rank 1–300, very close
          </li>
          <li>
            <span className="swatch yellow" /> Orange: rank 301–1500, warmer
          </li>
          <li>
            <span className="swatch red" /> Red: 1501+, far away
          </li>
        </ul>
        <p>
          You can use up to <strong>3 hints</strong>. Each hint is about half
          your best rank (rounded up) so the next one is always closer. If you
          are at rank 2, a hint reveals the secret word. Hints count as guesses.
        </p>
      </div>
    </Overlay>
  );
}

export function WinModal({
  puzzle,
  guesses,
  onClose,
  onUnlimited,
}: {
  puzzle: PuzzleMeta;
  guesses: Guess[];
  onClose: () => void;
  onUnlimited: () => void;
}) {
  const label = puzzle.gameNumber
    ? `Contexto #${puzzle.gameNumber}`
    : "unlimited Contexto";

  async function share() {
    const squares = guesses.map((guess) => rankEmoji(guess.rank));
    const rows: string[] = [];
    for (let i = 0; i < squares.length; i += 12) {
      rows.push(squares.slice(i, i + 12).join(""));
    }
    const text = `I got ${label} in ${guesses.length} guesses.\n\n${rows.join("\n")}\n`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <Overlay title={winCopy(guesses.length)} onClose={onClose}>
      <div className="prose">
        <p>
          You found the word in <strong>{guesses.length}</strong> guesses.
        </p>
        <div className="share-preview">
          {guesses.slice(-24).map((guess) => (
            <span key={`${guess.word}-${guess.rank}`}>{rankEmoji(guess.rank)}</span>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn primary" onClick={share}>
            Copy results
          </button>
          <button className="btn" onClick={onUnlimited}>
            Play unlimited
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function GaveUpModal({
  secret,
  onClose,
  onUnlimited,
}: {
  secret: string;
  onClose: () => void;
  onUnlimited: () => void;
}) {
  return (
    <Overlay title="The secret word" onClose={onClose}>
      <div className="prose">
        <p>
          Today&apos;s word was <strong>{secret}</strong>.
        </p>
        <div className="modal-actions">
          <button className="btn primary" onClick={onUnlimited}>
            Play unlimited
          </button>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function ConfirmGiveUp({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Overlay title="Give up?" onClose={onClose}>
      <div className="prose">
        <p>This will reveal the secret word and end the game.</p>
        <div className="modal-actions">
          <button className="btn danger" onClick={onConfirm}>
            Reveal word
          </button>
          <button className="btn" onClick={onClose}>
            Keep playing
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function Menu({
  onHowTo,
  onHint,
  onGiveUp,
  onTheme,
  dark,
  onClose,
  disabled,
  hintDisabled,
  hintsLeft,
}: {
  onHowTo: () => void;
  onHint: () => void;
  onGiveUp: () => void;
  onTheme: () => void;
  dark: boolean;
  onClose: () => void;
  disabled: boolean;
  hintDisabled: boolean;
  hintsLeft: number;
}) {
  return (
    <Overlay title="Menu" onClose={onClose}>
      <div className="menu-list">
        <button onClick={onHowTo}>How to play</button>
        <button onClick={onHint} disabled={hintDisabled}>
          Hint · {hintsLeft} left
        </button>
        <button onClick={onGiveUp} disabled={disabled}>
          Give up
        </button>
        <button onClick={onTheme}>{dark ? "Light mode" : "Dark mode"}</button>
      </div>
    </Overlay>
  );
}
