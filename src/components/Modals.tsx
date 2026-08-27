"use client";

import { rankEmoji, winCopy } from "@/lib/heat";
import { COPY } from "@/lib/copy";
import type { GameLang, Guess, PuzzleMeta } from "@/lib/types";
import type { ReactNode } from "react";

function Overlay({
  title,
  children,
  onClose,
  className,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className={className ? `modal ${className}` : "modal"}
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

export function HowToPlay({ onClose, lang = "en" }: { onClose: () => void; lang?: GameLang }) {
  if (lang === "th") {
    return (
      <Overlay title="วิธีเล่น" onClose={onClose}>
        <div className="prose">
          <p>หาคำลับ ทายได้ไม่จำกัดครั้ง</p>
          <p>
            ทายได้ทุกคำไทยในคลัง — คำลับมักเป็นคำนามในชีวิตประจำวัน เช่น ของ สัตว์ อาหาร สถานที่
          </p>
          <p>
            ระบบจัดอันดับคำตามความใกล้ของความหมายกับคำลับ จากเวกเตอร์ fastText ภาษาไทย
          </p>
          <p>
            หลังทายจะเห็นเลขอันดับ คำลับคือหมายเลข <strong>1</strong>
          </p>
          <ul>
            <li>
              <span className="swatch green" /> เขียว: อันดับ 1–300 ใกล้มาก
            </li>
            <li>
              <span className="swatch yellow" /> ส้ม: 301–1500 อุ่นขึ้น
            </li>
            <li>
              <span className="swatch red" /> แดง: 1501+ ไกล
            </li>
          </ul>
          <p>
            ใบ้ได้สูงสุด <strong>3 ครั้ง</strong> ไม่ดึงคำจากคลังมาให้ทาย
            ครั้งแรกใบ้หมวดกว้าง เช่น กินได้ ครั้งต่อมาเจาะจงขึ้น เช่น ผลไม้ แล้วลักษณะเด่น เช่น สีแดง
            คำใบ้จะค้างไว้ด้านบน
          </p>
        </div>
      </Overlay>
    );
  }
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
          You can use up to <strong>3 hints</strong>. They are short clues, not
          extra guesses: first a broad category (edible), then a tighter type
          (fruit), then a distinctive trait (often red). Hints stay pinned at
          the top.
        </p>
      </div>
    </Overlay>
  );
}

export function WinModal({
  puzzle,
  guesses,
  onClose,
}: {
  puzzle: PuzzleMeta;
  guesses: Guess[];
  onClose: () => void;
}) {
  const lang = puzzle.lang ?? "en";
  const t = COPY[lang];

  return (
    <Overlay title={winCopy(guesses.length)} onClose={onClose}>
      <div className="prose">
        <p>
          {t.foundIn} <strong>{guesses.length}</strong> {t.guesses.toLowerCase()}.
        </p>
        <div className="share-preview">
          {guesses.slice(-24).map((guess) => (
            <span key={`${guess.word}-${guess.rank}`}>{rankEmoji(guess.rank)}</span>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function GaveUpModal({
  secret,
  onClose,
  lang = "en",
}: {
  secret: string;
  onClose: () => void;
  lang?: GameLang;
}) {
  const t = COPY[lang];
  return (
    <Overlay title={lang === "th" ? "คำลับ" : "The secret word"} onClose={onClose}>
      <div className="prose">
        <p>
          {lang === "th" ? "คำวันนี้คือ" : "Today's word was"} <strong>{secret}</strong>.
        </p>
        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function ConfirmGiveUp({
  onConfirm,
  onClose,
  lang = "en",
}: {
  onConfirm: () => void;
  onClose: () => void;
  lang?: GameLang;
}) {
  const t = COPY[lang];
  return (
    <Overlay title={lang === "th" ? "ยอมแพ้?" : "Give up?"} onClose={onClose}>
      <div className="prose">
        <p>
          {lang === "th"
            ? "จะเฉลยคำลับและจบเกมนี้"
            : "This will reveal the secret word and end the game."}
        </p>
        <div className="modal-actions">
          <button className="btn danger" onClick={onConfirm}>
            {t.reveal}
          </button>
          <button className="btn" onClick={onClose}>
            {t.keepPlaying}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function NearbyModal({
  words,
  loading,
  error,
  onClose,
  lang = "en",
}: {
  words: Guess[];
  loading: boolean;
  error?: string;
  onClose: () => void;
  lang?: GameLang;
}) {
  const t = COPY[lang];
  return (
    <Overlay title={t.nearbyTitle} onClose={onClose} className="nearby-modal">
      {loading ? (
        <p className="calculating">{t.calculating}</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        <ol className="nearby-list">
          {words.map((item) => (
            <li key={`${item.rank}-${item.word}`} className="nearby-row">
              <span className="nearby-rank">{item.rank}</span>
              <span className="nearby-word">{item.word}</span>
            </li>
          ))}
        </ol>
      )}
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
  lang = "en",
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
  lang?: GameLang;
}) {
  const t = COPY[lang];
  return (
    <Overlay title={t.menu} onClose={onClose}>
      <div className="menu-list">
        <button onClick={onHowTo}>{t.howTo}</button>
        <button onClick={onHint} disabled={hintDisabled}>
          {t.hint} · {hintsLeft}
        </button>
        <button onClick={onGiveUp} disabled={disabled}>
          {t.giveUp}
        </button>
        <button onClick={onTheme}>{dark ? t.light : t.dark}</button>
      </div>
    </Overlay>
  );
}
