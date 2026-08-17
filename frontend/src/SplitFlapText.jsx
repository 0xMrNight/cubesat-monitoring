import { useEffect, useMemo, useState } from "react";

const DEFAULT_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function normalizeWord(word, padTo) {
  const value = String(word).toUpperCase();
  return padTo > value.length ? value.padEnd(padTo, " ") : value.slice(0, padTo || value.length);
}

export default function SplitFlapText({
  words = [],
  flipDuration = 0.12,
  stagger = 0.06,
  cycleDelay = 2400,
  charset = "alphanumeric",
  flipsPerChar = 8,
  tileColor = "#111827",
  textColor = "#f8fafc",
  tileRadius = 8,
  gap = 6,
  fontSize = 52,
  loop = true,
  padTo = 12,
}) {
  const wordsKey = words.join("\u0000");
  const safeWords = useMemo(() => (wordsKey ? wordsKey.split("\u0000") : [""]).map((word) => normalizeWord(word, padTo)), [padTo, wordsKey]);
  const alphabet = charset === "alphanumeric" ? DEFAULT_CHARSET : String(charset).toUpperCase();
  const [wordIndex, setWordIndex] = useState(0);
  const [display, setDisplay] = useState(() => safeWords[0] || "");
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setDisplay(safeWords[0] || "");
      setWordIndex(0);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [safeWords]);

  useEffect(() => {
    if (safeWords.length < 2 || (!loop && wordIndex === safeWords.length - 1)) return undefined;

    const cycleTimer = window.setTimeout(() => {
      const nextIndex = (wordIndex + 1) % safeWords.length;
      const nextWord = safeWords[nextIndex];
      const current = display.padEnd(nextWord.length, " ");
      const next = nextWord.padEnd(current.length, " ");
      setFlipping(true);

      const maxLength = Math.max(current.length, next.length);
      for (let index = 0; index < maxLength; index += 1) {
        const delay = index * stagger * 1000;
        window.setTimeout(() => {
          setDisplay((value) => {
            const chars = value.padEnd(maxLength, " ").split("");
            const target = next[index] || " ";
            chars[index] = target;
            return chars.join("");
          });
        }, delay + flipDuration * 1000);
      }

      window.setTimeout(() => {
        setWordIndex(nextIndex);
        setFlipping(false);
      }, maxLength * stagger * 1000 + flipDuration * 1000 + 40);
    }, cycleDelay);

    return () => window.clearTimeout(cycleTimer);
  }, [cycleDelay, display, flipDuration, loop, safeWords, stagger, wordIndex]);

  const characters = display.split("");
  const characterSet = alphabet || DEFAULT_CHARSET;

  return (
    <div
      className={`split-flap-text ${flipping ? "is-flipping" : ""}`}
      style={{
        "--flap-tile-color": tileColor,
        "--flap-text-color": textColor,
        "--flap-radius": `${tileRadius}px`,
        "--flap-gap": `${gap}px`,
        "--flap-font-size": `${fontSize}px`,
        "--flap-duration": `${flipDuration}s`,
        "--flap-stagger": `${stagger}s`,
        "--flips-per-char": flipsPerChar,
      }}
      role="status"
      aria-live="polite"
      aria-label={safeWords[wordIndex]?.trim() || "Mission status"}
    >
      {characters.map((character, index) => {
        const symbolIndex = Math.max(0, characterSet.indexOf(character));
        const symbol = character === " " ? " " : character;
        return (
          <span
            className="split-flap-tile"
            key={`${index}-${character}`}
            style={{ "--tile-index": index, "--symbol-index": symbolIndex }}
          >
            <span className="split-flap-tile-face">{symbol}</span>
          </span>
        );
      })}
    </div>
  );
}
