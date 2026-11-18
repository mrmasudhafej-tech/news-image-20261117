// The World in One Image — Tuesday, 17 November 2026.
// Node 22 program, standard library only, no network, fully deterministic.
// Draws a 1024x1024 newspaper front page and writes it as a PNG.
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

// ---------------------------------------------------------------------------
// STORIES — real headlines of Tuesday 17 November 2026 (verified).
// Only these strings are swapped when headlines are updated; layout wraps
// every headline on word boundaries to fit its panel.
// ---------------------------------------------------------------------------
const STORIES: { kicker: string; headline: string; subhead: string; icon: string }[] = [
  {
    kicker: "MIDDLE EAST — WAR",
    headline: "IRAN DRONES TARGET US RADAR IN BAHRAIN",
    subhead: "US jets strike missile site on Qeshm Island in reply",
    icon: "radar",
  },
  {
    kicker: "EUROPE — WAR",
    headline: "UKRAINE HITS CRIMEA BRIDGE AGAIN",
    subhead: "Road arch falls; Russia pounds Kyiv bridges",
    icon: "bridge",
  },
  {
    kicker: "ASIA-PACIFIC — DIPLOMACY",
    headline: "QUAD LEADERS MEET IN MANILA",
    subhead: "Trump, Modi, Takaichi, Albanese: sea watch, minerals",
    icon: "globe",
  },
  {
    kicker: "ASIA — SECURITY",
    headline: "RUSSIAN JETS ENTER JAPAN AIRSPACE",
    subhead: "Tokyo scrambles fighters, protests",
    icon: "jet",
  },
  {
    kicker: "CLIMATE — COP31",
    headline: "CLIMATE MINISTERS TAKE OVER COP31",
    subhead: "Draft deal draws fire in Antalya",
    icon: "leaf",
  },
  {
    kicker: "ECONOMY — MARKETS",
    headline: "US STOCKS FALL FOR 4TH DAY",
    subhead: "AI sell-off bites; Nvidia beats after bell",
    icon: "chart",
  },
];

const ALSO_TODAY: string[] = [
  "FRANCE STRIKES FOR HIGHER PAY - 146,000 MARCH",
  "ULA BLAMES VULCAN STAGE FOR 40 LOST SATELLITES",
];

// ---------------------------------------------------------------------------
// Canvas: 1024x1024 RGB pixel buffer.
// ---------------------------------------------------------------------------
const W = 1024;
const H = 1024;
const PAPER: [number, number, number] = [247, 243, 232];
const INK: [number, number, number] = [17, 17, 17];
const RED: [number, number, number] = [176, 30, 30];
const BLUE: [number, number, number] = [29, 78, 137];
const GREY: [number, number, number] = [90, 86, 76];
const LIGHT: [number, number, number] = [255, 252, 244];

type RGB = [number, number, number];
const px = new Uint8Array(W * H * 3);

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
  }
}

function hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
  for (let t0 = 0; t0 < t; t0++) for (let x = x0; x <= x1; x++) setPixel(x, y + t0, c);
}

function vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
  for (let t0 = 0; t0 < t; t0++) for (let y = y0; y <= y1; y++) setPixel(x + t0, y, c);
}

// Bresenham line.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) setPixel(x + a, y + b, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPixel(x, y, c);
    }
  }
}

function ring(cx: number, cy: number, r: number, c: RGB, t = 2): void {
  for (let y = cy - r - t; y <= cy + r + t; y++) {
    for (let x = cx - r - t; x <= cx + r + t; x++) {
      const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (Math.abs(d - r) <= t / 2) setPixel(x, y, c);
    }
  }
}

// ---------------------------------------------------------------------------
// Bitmap font: 5 wide x 7 tall glyphs, defined by hand as rows of 5 bits.
// ---------------------------------------------------------------------------
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

// Normalise: lowercase -> uppercase, em dash -> hyphen, anything else -> space.
function normChar(ch: string): string {
  if (ch === "\u2014" || ch === "\u2013") return "-";
  const up = ch.toUpperCase();
  return GLYPHS[up] ? up : " ";
}

function textWidth(text: string, scale: number): number {
  const n = [...text].length;
  if (n === 0) return 0;
  return n * 6 * scale - scale;
}

function drawText(x: number, y: number, text: string, scale: number, c: RGB): void {
  let cx = x;
  for (const raw of text) {
    const ch = normChar(raw);
    const g = GLYPHS[ch];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") fillRect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(cx: number, y: number, text: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(text, scale) / 2), y, text, scale, c);
}

// Wrap on word boundaries so no line exceeds maxChars characters.
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur === "") { cur = w; continue; }
    if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Draw wrapped text, uppercased, at scale; returns the y after the last line.
function drawWrapped(x: number, y: number, text: string, scale: number, maxChars: number, c: RGB, lineGap = 4): string[] {
  const lines = wrapText(text.toUpperCase(), maxChars);
  let yy = y;
  for (const ln of lines) {
    drawText(x, yy, ln, scale, c);
    yy += 7 * scale + lineGap;
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Pictograms — simple geometric drawings from rects / circles / lines.
// ---------------------------------------------------------------------------
function drawIcon(kind: string, cx: number, cy: number, s: number, c: RGB, accent: RGB): void {
  if (kind === "radar") {
    ring(cx, cy, 34, c, 3);
    ring(cx, cy, 22, c, 2);
    ring(cx, cy, 10, c, 2);
    line(cx - 34, cy, cx + 34, cy, c, 2);
    line(cx, cy - 34, cx, cy + 34, c, 2);
    // Sweep wedge: a filled triangle from centre to upper right.
    line(cx, cy, cx + 26, cy - 20, accent, 3);
    line(cx, cy, cx + 30, cy - 6, accent, 3);
    fillCircle(cx + 24, cy - 16, 4, accent);
    fillCircle(cx, cy, 4, accent);
    // Blip dots.
    fillCircle(cx - 14, cy + 12, 3, accent);
    fillCircle(cx + 12, cy + 16, 3, c);
  } else if (kind === "bridge") {
    // Deck, two towers, suspension cables, a fallen arch segment.
    fillRect(cx - 40, cy + 8, 80, 6, c);
    fillRect(cx - 34, cy - 26, 7, 36, c);
    fillRect(cx + 27, cy - 26, 7, 36, c);
    line(cx - 30, cy - 26, cx, cy + 8, c, 2);
    line(cx + 30, cy - 26, cx, cy + 8, c, 2);
    line(cx - 30, cy - 26, cx - 40, cy + 8, GREY, 2);
    line(cx + 30, cy - 26, cx + 40, cy + 8, GREY, 2);
    // Broken arch piece, tilted, in red.
    line(cx - 6, cy - 2, cx + 12, cy - 14, accent, 4);
    fillCircle(cx + 14, cy - 16, 3, accent);
    hline(cx - 40, cx + 40, cy + 22, BLUE, 3);
  } else if (kind === "globe") {
    ring(cx, cy, 32, c, 3);
    line(cx - 32, cy, cx + 32, cy, c, 2);
    line(cx, cy - 32, cx, cy + 32, c, 2);
    // Meridian ellipse hint: two arcs via short chords.
    for (let a = -70; a <= 70; a += 10) {
      const t = (a * Math.PI) / 180;
      const x = Math.round(cx + 16 * Math.cos(t));
      const y = Math.round(cy + 32 * Math.sin(t));
      fillCircle(x, y, 2, c);
      fillCircle(2 * cx - x, y, 2, c);
    }
    fillCircle(cx - 18, cy - 14, 4, accent);
    fillCircle(cx + 16, cy + 12, 4, BLUE);
  } else if (kind === "jet") {
    // Side view: fuselage, nose, tail fin, wings, speed lines.
    line(cx - 34, cy, cx + 30, cy - 6, c, 5);
    line(cx + 30, cy - 6, cx + 40, cy - 2, c, 3);
    line(cx - 30, cy - 2, cx - 38, cy - 16, c, 4);
    line(cx - 10, cy + 2, cx - 22, cy + 16, c, 4);
    line(cx + 6, cy, cx - 2, cy + 14, c, 4);
    fillCircle(cx + 18, cy - 4, 3, accent);
    hline(cx - 44, cx - 38, cy + 8, GREY, 2);
    hline(cx - 44, cx - 36, cy + 14, GREY, 2);
  } else if (kind === "leaf") {
    // Leaf: solid tilted ellipse, vein in accent, stem below.
    for (let y = cy - 22; y <= cy + 22; y++) {
      for (let x = cx - 28; x <= cx + 28; x++) {
        const dx = (x - cx) / 28;
        const dy = (y - cy) / 20;
        if (dx * dx + dy * dy <= 1) setPixel(x, y, c);
      }
    }
    line(cx - 24, cy + 16, cx + 24, cy - 16, accent, 2);
    line(cx - 24, cy + 16, cx - 32, cy + 28, c, 3);
  } else {
    // chart: axes + three rising bars.
    line(cx - 36, cy + 26, cx + 36, cy + 26, c, 3);
    line(cx - 36, cy + 26, cx - 36, cy - 28, c, 3);
    fillRect(cx - 28, cy + 6, 14, 20, BLUE);
    fillRect(cx - 6, cy - 8, 14, 34, c);
    fillRect(cx + 16, cy - 22, 14, 48, accent);
    line(cx - 32, cy - 18, cx + 32, cy - 26, accent, 2);
  }
}

// ---------------------------------------------------------------------------
// PNG encoder — hand-written: CRC32 table, chunks, zlib deflate (stdlib).
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // Raw scanlines: filter byte 0 + RGB rows.
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// Layout — 1024x1024.
// ---------------------------------------------------------------------------
function drawPage(): void {
  fillRect(0, 0, W, H, PAPER);
  // Outer frame.
  fillRect(0, 0, W, 10, INK);
  fillRect(0, H - 10, W, 10, INK);
  fillRect(0, 0, 10, H, INK);
  fillRect(W - 10, 0, 10, H, INK);
  // Thin inner frame.
  const M = 28;
  hline(M, W - M, 22, INK, 2);
  hline(M, W - M, H - 24, INK, 2);

  // Masthead.
  drawTextCentered(W / 2, 40, "THE WORLD IN ONE IMAGE", 5, INK);
  hline(120, W - 120, 92, RED, 4);
  drawTextCentered(W / 2, 108, "TUESDAY, 17 NOVEMBER 2026", 6, RED);
  drawTextCentered(W / 2, 162, "SIX STORIES FROM AROUND THE WORLD", 2, GREY);
  hline(M, W - M, 192, INK, 4);

  // Lead story (full width), y 208..438.
  const lead = STORIES[0];
  drawText(40, 214, lead.kicker, 2, RED);
  // Lead headline, scale 4, wrapped to 24 chars per line, left column.
  const leadLines = drawWrapped(40, 240, lead.headline, 4, 24, INK, 6);
  const leadSubY = 240 + leadLines.length * (7 * 4 + 6) + 4;
  drawWrapped(40, leadSubY, lead.subhead, 3, 31, BLUE, 5);
  // Lead pictogram, right side, in a light panel.
  fillRect(660, 208, 328, 214, LIGHT);
  hline(660, 988, 208, INK, 2);
  hline(660, 988, 422, INK, 2);
  vline(660, 208, 422, INK, 2);
  vline(988, 208, 422, INK, 2);
  drawIcon("radar", 824, 300, 1, INK, RED);
  drawTextCentered(824, 368, "US RADAR SITE", 2, GREY);
  drawTextCentered(824, 388, "IN BAHRAIN", 2, GREY);
  hline(M, W - M, 438, INK, 3);

  // Grid: 3 columns x 2 rows, y 456..952. Five stories + ALSO TODAY cell.
  const gridTop = 456;
  const colW = 312;
  const colGap = 16;
  const rowH = 238;
  const rowGap = 20;
  const cells: { x: number; y: number; story: (typeof STORIES)[number] | null }[] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      cells.push({
        x: M + c * (colW + colGap),
        y: gridTop + r * (rowH + rowGap),
        story: idx < 5 ? STORIES[idx + 1] : null,
      });
    }
  }
  for (const cell of cells) {
    // Cell frame.
    fillRect(cell.x, cell.y, colW, rowH, LIGHT);
    hline(cell.x, cell.x + colW - 1, cell.y, INK, 2);
    hline(cell.x, cell.x + colW - 1, cell.y + rowH - 1, INK, 2);
    vline(cell.x, cell.y, cell.y + rowH - 1, INK, 2);
    vline(cell.x + colW - 1, cell.y, cell.y + rowH - 1, INK, 2);
    if (cell.story) {
      const s = cell.story;
      drawIcon(s.icon, cell.x + 52, cell.y + 52, 1, INK, RED);
      // Kicker beside the icon, wrapped to 15 chars/line so the longest
      // ("ASIA-PACIFIC - DIPLOMACY") never runs past the cell edge.
      drawWrapped(cell.x + 104, cell.y + 16, s.kicker, 2, 15, RED, 3);
      const headY = cell.y + 108;
      const headLines = drawWrapped(cell.x + 16, headY, s.headline, 3, 15, INK, 4);
      const subY = headY + headLines.length * (7 * 3 + 4) + 6;
      drawWrapped(cell.x + 16, subY, s.subhead, 2, 23, BLUE, 3);
    } else {
      // ALSO TODAY cell.
      drawText(cell.x + 16, cell.y + 16, "ALSO TODAY", 3, RED);
      hline(cell.x + 16, cell.x + colW - 17, cell.y + 46, RED, 3);
      let yy = cell.y + 62;
      for (const item of ALSO_TODAY) {
        drawText(cell.x + 16, yy, "*", 2, RED);
        const lines = drawWrapped(cell.x + 34, yy, item, 2, 21, INK, 3);
        yy += lines.length * (7 * 2 + 3) + 16;
      }
    }
  }

  // Footer.
  drawTextCentered(W / 2, 972, "SOURCES: REUTERS, AP, BBC", 2, GREY);
}

// ---------------------------------------------------------------------------
function main(): void {
  drawPage();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), png);
}

main();
