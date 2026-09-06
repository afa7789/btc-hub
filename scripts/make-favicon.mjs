/**
 * Builds public/favicon.svg from the display font's own outline.
 *
 * The glyph is extracted as a vector path rather than set as SVG <text>,
 * because a favicon renders outside the page and cannot reach a web font.
 * Run manually when the wordmark or display face changes.
 */
import opentype from "opentype.js";
import { readFileSync, writeFileSync } from "node:fs";

const FONT = process.argv[2] ?? "/tmp/fonts/pirata.ttf";
const GLYPH = process.argv[3] ?? "B";
const SIZE = 512;

const font = opentype.parse(readFileSync(FONT).buffer);
// Oversized, then measured and fitted — the em box is mostly empty space.
const probe = font.getPath(GLYPH, 0, 0, 1000);
const { x1, y1, x2, y2 } = probe.getBoundingBox();
const glyphW = x2 - x1;
const glyphH = y2 - y1;

// 92% of the box: blackletter caps are narrow, so a tighter fit gives the
// 16px rendering more presence.
const scale = (SIZE * 0.92) / Math.max(glyphW, glyphH);
const path = font.getPath(
  GLYPH,
  SIZE / 2 - (x1 + glyphW / 2) * scale,
  SIZE / 2 - (y1 + glyphH / 2) * scale,
  1000 * scale,
);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="#000000"/>
  <path d="${path.toPathData(2)}" fill="#ff9900"/>
</svg>
`;
writeFileSync("public/favicon.svg", svg);
console.log(`public/favicon.svg — glyph "${GLYPH}", ${glyphW.toFixed(0)}x${glyphH.toFixed(0)} em units, scale ${scale.toFixed(3)}`);
