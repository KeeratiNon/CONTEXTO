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
  copy: string;
  playUnlimited: string;
  foundIn: string;
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
    copy: "Copy results",
    playUnlimited: "Play unlimited",
    foundIn: "You found the word in",
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
    copy: "คัดลอกผล",
    playUnlimited: "เล่นไม่จำกัด",
    foundIn: "คุณทายได้ใน",
  },
};
