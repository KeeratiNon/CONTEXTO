import { rankToColor, rankToPercent } from "@/lib/heat";
import type { Guess } from "@/lib/types";

export function GuessBar({
  guess,
  vocabSize,
  flash = false,
  current = false,
}: {
  guess: Guess;
  vocabSize: number;
  flash?: boolean;
  current?: boolean;
}) {
  const percent = rankToPercent(guess.rank, vocabSize);
  const color = rankToColor(guess.rank);

  return (
    <div
      className={`guess-row${flash ? " guess-flash" : ""}${current ? " current" : ""}`}
    >
      <div
        className="guess-fill"
        style={{ width: `${percent}%`, background: color }}
      />
      <div className="guess-content">
        <span className="guess-word">
          {guess.word}
          {guess.fromHint ? <span className="hint-tag">hint</span> : null}
        </span>
        <span className="guess-rank">{guess.rank}</span>
      </div>
    </div>
  );
}
