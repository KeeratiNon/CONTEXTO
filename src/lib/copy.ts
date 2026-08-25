import type { GameLang } from "./lang";

type Copy = {
  daily: string;
  unlimited: string;
  guesses: string;
  hint: string;
  giveUp: string;
  typeWord: string;
  gameOver: string;
  enter: string;
  calculating: string;
  alreadyGuessed: string;
  unknownWord: string;
  networkError: string;
  notSeededTitle: string;
  notSeededBody: string;
  howTo: string;
  light: string;
  dark: string;
  menu: string;
  keepPlaying: string;
  reveal: string;
  close: string;
  playUnlimited: string;
  playAgain: string;
  viewResults: string;
  foundIn: string;
  hintLabel: string;
  thinkingHint: string;
  hintsNotReady: string;
  retryHints: string;
};

export const COPY: Record<GameLang, Copy> = {
  en: {
    daily: "Daily game",
    unlimited: "Unlimited",
    guesses: "Guesses",
    hint: "Hint",
    giveUp: "Give up",
    typeWord: "Type a word",
    gameOver: "Game over",
    enter: "Enter",
    calculating: "calculating...",
    alreadyGuessed: "You already guessed this word.",
    unknownWord: "I don't know this word.",
    networkError: "Network error. Try again.",
    notSeededTitle: "Database not seeded.",
    notSeededBody: "Run npm run seed then restart the server.",
    howTo: "How to play",
    light: "Light mode",
    dark: "Dark mode",
    menu: "Menu",
    keepPlaying: "Keep playing",
    reveal: "Reveal word",
    close: "Close",
    playUnlimited: "Play unlimited",
    playAgain: "Play again",
    viewResults: "View results",
    foundIn: "You found the word in",
    hintLabel: "Hint",
    thinkingHint: "preparing hints...",
    hintsNotReady: "Hints are still preparing...",
    retryHints: "Try again",
  },
  th: {
    daily: "รายวัน",
    unlimited: "ไม่จำกัด",
    guesses: "ครั้ง",
    hint: "ใบ้",
    giveUp: "ยอมแพ้",
    typeWord: "พิมพ์คำไทย",
    gameOver: "จบเกม",
    enter: "ทาย",
    calculating: "กำลังคำนวณ...",
    alreadyGuessed: "ทายคำนี้ไปแล้ว",
    unknownWord: "ไม่รู้จักคำนี้",
    networkError: "เน็ตมีปัญหา ลองอีกครั้ง",
    notSeededTitle: "ยังไม่ได้ seed ภาษาไทย",
    notSeededBody: "รัน npm run prepare-data:th แล้วรีสตาร์ทเซิร์ฟเวอร์",
    howTo: "วิธีเล่น",
    light: "โหมดสว่าง",
    dark: "โหมดมืด",
    menu: "เมนู",
    keepPlaying: "เล่นต่อ",
    reveal: "เฉลย",
    close: "ปิด",
    playUnlimited: "เล่นไม่จำกัด",
    playAgain: "เล่นใหม่",
    viewResults: "ดูผล",
    foundIn: "คุณทายได้ใน",
    hintLabel: "คำใบ้",
    thinkingHint: "กำลังเตรียมคำใบ้...",
    hintsNotReady: "กำลังเตรียมคำใบ้ รอสักครู่...",
    retryHints: "ลองอีกครั้ง",
  },
};
