/**
 * Build-time FIGlet banners.
 *
 * ASCII art has a fixed width in characters, so it only works for short
 * strings: "BTC_THINGS" is 77 columns in this font, which fits a desktop hero
 * but still collapses to ~5px per character on a phone. Anything longer than a
 * word or two belongs in --font-display instead. `columns` is returned so the
 * page can size the <pre> to fit its container exactly.
 *
 * The font is a solid-block face on purpose. Delicate ones (fraktur) turn to
 * mush below ~12px per character; blocks stay readable as letterforms.
 */
import figlet from "figlet";

export interface Banner {
  text: string;
  columns: number;
  rows: number;
}

export function asciiBanner(
  text: string,
  font: figlet.Fonts = "ANSI Shadow",
): Banner {
  const art = figlet.textSync(text, { font });
  const lines = art.split("\n");
  // Trailing blank lines are padding in several FIGlet fonts.
  while (lines.length && lines[lines.length - 1]?.trim() === "") lines.pop();

  return {
    text: lines.join("\n"),
    columns: Math.max(...lines.map((l) => l.length)),
    rows: lines.length,
  };
}
