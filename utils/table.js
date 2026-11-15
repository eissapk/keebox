// entries table: drawTable(entries) prints a box table (no passwords), fitted to the terminal width
const textWidth = (str) => [...str].length;
const cleanCell = (val) =>
  String(val ?? "")
    .replace(/\s+/g, " ")
    .trim();
const truncate = (str, max) => (textWidth(str) <= max ? str : [...str].slice(0, Math.max(max - 1, 0)).join("") + "…");
const pad = (str, w, right) => (right ? " ".repeat(w - textWidth(str)) + str : str + " ".repeat(w - textWidth(str)));

// "15-11-2026" (day-month-year) in local time, "" if missing/invalid (entries added before timestamps existed)
const formatDate = (iso) => {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return "";
  return String(d.getDate()).padStart(2, "0") + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + d.getFullYear();
};
const DATE_COLUMNS = ["created", "updated"];

// shrink the widest columns until the table fits the terminal (columns in `fixed` never shrink)
function fitWidths(widths, maxTotal, fixed) {
  const total = () => widths.reduce((a, b) => a + b, 0) + widths.length * 3 + 1; // "│ " + " " per cell + last "│"
  while (total() > maxTotal) {
    let widest = -1;
    for (let i = 0; i < widths.length; i++) if (!fixed.includes(i) && (widest === -1 || widths[i] > widths[widest])) widest = i;
    if (widest === -1 || widths[widest] <= 4) break; // can't shrink any further, let the terminal wrap
    widths[widest]--;
  }
  return widths;
}

// print entries as a box table (no passwords)
function drawTable(entries) {
  const { FIELDS, SECRET_FIELDS, colors } = require("./index"); // here, not at the top: index.js loads this file, so its exports are only ready at call time
  const COLUMNS = ["id", ...FIELDS, ...DATE_COLUMNS];
  if (!entries.length) return console.log(colors.cyan("0 entries"));

  const cell = (obj, col) => {
    if (SECRET_FIELDS.includes(col) && obj[col]) return "***";
    if (col === "updated" && formatDate(obj.updated) === formatDate(obj.created)) return ""; // same day as created -> "-"
    return DATE_COLUMNS.includes(col) ? formatDate(obj[col]) : cleanCell(obj[col]);
  };
  const rows = entries.map((obj) => COLUMNS.map((col) => cell(obj, col)));
  const widths = COLUMNS.map((col, i) => Math.max(col.length, ...rows.map((r) => textWidth(r[i]) || 1)));
  const fixed = COLUMNS.map((col, i) => (col === "id" || DATE_COLUMNS.includes(col) ? i : -1)).filter((i) => i !== -1);
  fitWidths(widths, process.stdout.columns || Infinity, fixed);

  const line = (l, m, r) => colors.gray(l + widths.map((w) => "─".repeat(w + 2)).join(m) + r);
  const bar = colors.gray("│");
  const row = (cells) => bar + cells.map((c) => " " + c + " ").join(bar) + bar;

  const out = [line("╭", "┬", "╮"), row(COLUMNS.map((col, i) => colors.bold.cyan(pad(truncate(col.toUpperCase(), widths[i]), widths[i])))), line("├", "┼", "┤")];
  rows.forEach((r) => {
    out.push(
      row(
        r.map((val, i) => {
          if (!val) return colors.gray(pad("-", widths[i]));
          const text = pad(truncate(val, widths[i]), widths[i], i === 0);
          return i === 0 ? colors.yellow(text) : text;
        })
      )
    );
  });
  out.push(line("╰", "┴", "╯"));
  out.push(colors.gray(" " + entries.length + (entries.length === 1 ? " entry" : " entries")));
  console.log(out.join("\n"));
}

module.exports = drawTable;
