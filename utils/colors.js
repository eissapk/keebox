// tiny ANSI color helper (replaces the "colors" package): colors.red("x"), colors.bold.cyan("x")
// disabled when output isn't a terminal or NO_COLOR is set, FORCE_COLOR turns it on
const useColor = !("NO_COLOR" in process.env) && ("FORCE_COLOR" in process.env || !!process.stdout.isTTY);
const STYLES = { bold: [1, 22], red: [31, 39], green: [32, 39], yellow: [33, 39], cyan: [36, 39], gray: [90, 39] };
function style(codes) {
  const fn = (str) => (useColor ? codes.reduceRight((s, [open, close]) => `\x1b[${open}m${s}\x1b[${close}m`, String(str)) : String(str));
  for (const name in STYLES) Object.defineProperty(fn, name, { get: () => style([...codes, STYLES[name]]) });
  return fn;
}
const colors = style([]);

module.exports = colors;
