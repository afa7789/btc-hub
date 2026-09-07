/**
 * Rasterises the site's blackletter face into ASCII art.
 *
 * FIGlet has no face that is both genuinely blackletter and legible at the size
 * a whole word needs: `fraktur` is the only true one and it needs ~25px per
 * character, which caps the string at about five. So instead of picking a
 * FIGlet face, this draws the real gothic font to a canvas and samples it.
 * The letterforms are then authentically gothic and still built from ASCII.
 *
 * Run manually when the wordmark changes; the output is committed:
 *   node scripts/render-ascii-banner.mjs
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const TEXT = process.argv[2] ?? "BTC_THINGS";
const COLUMNS = Number(process.argv[3] ?? 110);
const FAMILY = process.argv[4] ?? "Pirata One";
const OUT = "src/assets/wordmark.txt";

/*
 * Thresholds, not an even gradient. An even ramp maps a thin blackletter stroke
 * to light characters (`:`, `-`, `.`) because each cell is only partly covered,
 * and the letterforms come out skeletal. Weighting almost everything to a dense
 * glyph fills the strokes so they read as letters.
 */
const LEVELS = [
  { min: 0.5, char: "W" },
  { min: 0.22, char: "w" },
  { min: 0.08, char: "." },
];
// A monospace cell is about 0.6 as wide as it is tall, so rows must sample a
// taller slice than columns do or the art comes out squashed.
const CELL_ASPECT = 0.6;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<!doctype html><html><head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${FAMILY.replace(/ /g, "+")}&display=block">
</head><body></body></html>`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);

const grid = await page.evaluate(
  ({ text, columns, cellAspect, family }) => {
    const size = 400;
    const measure = document.createElement("canvas");
    const mctx = measure.getContext("2d");
    mctx.font = `${size}px "${family}"`;
    const width = Math.ceil(mctx.measureText(text).width);

    const canvas = document.createElement("canvas");
    canvas.width = width + size * 0.4;
    canvas.height = Math.ceil(size * 1.5);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = `${size}px "${family}"`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, size * 0.2, size * 1.1);

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const cellW = canvas.width / columns;
    const cellH = cellW / cellAspect;
    const rows = Math.floor(canvas.height / cellH);

    const cells = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < columns; c++) {
        let sum = 0;
        let n = 0;
        for (
          let y = Math.floor(r * cellH);
          y < Math.floor((r + 1) * cellH);
          y++
        ) {
          for (
            let x = Math.floor(c * cellW);
            x < Math.floor((c + 1) * cellW);
            x++
          ) {
            if (y >= canvas.height || x >= canvas.width) continue;
            sum += data[(y * canvas.width + x) * 4];
            n++;
          }
        }
        row.push(n ? sum / n / 255 : 0);
      }
      cells.push(row);
    }
    return cells;
  },
  { text: TEXT, columns: COLUMNS, cellAspect: CELL_ASPECT, family: FAMILY },
);
await browser.close();

const lines = grid.map((row) =>
  row
    .map((v) => LEVELS.find((level) => v >= level.min)?.char ?? " ")
    .join("")
    .replace(/\s+$/, ""),
);
while (lines.length && !lines[0].trim()) lines.shift();
while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

writeFileSync(OUT, `${lines.join("\n")}\n`);
console.log(
  `${OUT}: ${Math.max(...lines.map((l) => l.length))} cols x ${lines.length} rows`,
);
console.log(lines.join("\n"));
