// tiny ANSI color helper (replaces the "colors" package): colors.red("x"), colors.bold.amber("x")
// KeeBox palette (same as the website): warm amber accent, soft green / red, warm grays on a dark terminal.
// - truecolor when the terminal says so (COLORTERM=truecolor|24bit, or a known truecolor terminal),
//   else the closest xterm-256 color, else the basic 16 ANSI colors
// - disabled when output isn't a terminal or NO_COLOR is set, FORCE_COLOR turns it on (FORCE_COLOR=0 turns it off)
const env = process.env;

function colorLevel() {
  if ("NO_COLOR" in env || env.FORCE_COLOR === "0" || env.FORCE_COLOR === "false") return 0;
  if (!("FORCE_COLOR" in env) && !process.stdout.isTTY) return 0; // "get > list.txt" stays plain text
  if (env.TERM === "dumb" && !("FORCE_COLOR" in env)) return 0;
  if (env.FORCE_COLOR === "3" || /^(truecolor|24bit)$/i.test(env.COLORTERM || "")) return 3;
  if (["iTerm.app", "WezTerm", "vscode", "ghostty"].includes(env.TERM_PROGRAM) || env.WT_SESSION || /kitty|alacritty|direct/.test(env.TERM || "")) return 3;
  if (process.platform === "win32") return 3; // Windows 10+ console supports 24-bit
  if (env.FORCE_COLOR === "2" || /256/.test(env.TERM || "")) return 2;
  return 1;
}
const level = colorLevel();

// [hex, basic ANSI fallback]
const PALETTE = {
  amber: ["#f5a524", 33], // accent: headers, ids, the "$" prompt
  green: ["#7ccf8a", 32], // success
  red: ["#f07a6e", 31], // errors
  blue: ["#7aa8f0", 34], // info
  text: ["#ece6da", 37], // regular text, a warm off-white
  gray: ["#8a847a", 90], // hints, secondary text
  dim: ["#55514b", 90], // borders, empty cells, comments
};
const ALIASES = { yellow: "amber", cyan: "amber", white: "text", muted: "gray" }; // older names keep working

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
// closest xterm-256 color: nearest of the 6x6x6 cube (16-231) and the grayscale ramp (232-255)
const CUBE = [0, 95, 135, 175, 215, 255];
function rgbTo256(rgb) {
  const dist = (c) => c.reduce((sum, v, i) => sum + (v - rgb[i]) ** 2, 0);
  const near = (v) => CUBE.reduce((best, c, i) => (Math.abs(c - v) < Math.abs(CUBE[best] - v) ? i : best), 0);
  const [r, g, b] = rgb.map(near);
  const cube = { code: 16 + 36 * r + 6 * g + b, d: dist([CUBE[r], CUBE[g], CUBE[b]]) };
  const step = Math.max(0, Math.min(23, Math.round((rgb.reduce((a, v) => a + v, 0) / 3 - 8) / 10)));
  const gray = { code: 232 + step, d: dist(Array(3).fill(8 + step * 10)) };
  return gray.d < cube.d ? gray.code : cube.code;
}
function fg(hex, basic) {
  if (level === 3) return [`38;2;${hexToRgb(hex).join(";")}`, 39];
  if (level === 2) return [`38;5;${rgbTo256(hexToRgb(hex))}`, 39];
  return [basic, 39];
}

const STYLES = { bold: [1, 22], italic: [3, 23], underline: [4, 24] };
for (const name in PALETTE) STYLES[name] = fg(...PALETTE[name]);
for (const name in ALIASES) STYLES[name] = STYLES[ALIASES[name]];

function style(codes) {
  // re-open the outer style after a nested reset, so colors.green("a " + colors.bold("b") + " c") stays green
  const fn = (str) =>
    level
      ? codes.reduceRight((s, [open, close]) => `\x1b[${open}m${s.split(`\x1b[${close}m`).join(`\x1b[${close}m\x1b[${open}m`)}\x1b[${close}m`, String(str))
      : String(str);
  for (const name in STYLES) Object.defineProperty(fn, name, { get: () => style([...codes, STYLES[name]]) });
  return fn;
}
const colors = style([]);

colors.enabled = level > 0;
colors.level = level;
// text without ANSI codes / its width on screen
colors.strip = (str) => String(str).replace(/\x1b\[[0-9;]*m/g, "");
colors.width = (str) => [...colors.strip(str)].length;

module.exports = colors;
