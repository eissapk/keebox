const { modulesPath, decrypt, isAndroid, copyToClipboard } = require("./olum");
const colors = require(modulesPath + "/colors");
const deleteEntry = require("./delete");
const updateEntry = require("./update");

const COLUMNS = ["id", "name", "location", "username", "login"];

const width = (str) => [...str].length;
const clean = (val) => String(val ?? "").replace(/\s+/g, " ").trim();
const truncate = (str, max) => (width(str) <= max ? str : [...str].slice(0, Math.max(max - 1, 0)).join("") + "…");
const pad = (str, w, right) => (right ? " ".repeat(w - width(str)) + str : str + " ".repeat(w - width(str)));

// shrink the widest columns until the table fits the terminal (id never shrinks)
function fitWidths(widths, maxTotal) {
  const total = () => widths.reduce((a, b) => a + b, 0) + widths.length * 3 + 1; // "│ " + " " per cell + last "│"
  while (total() > maxTotal) {
    let widest = 1;
    for (let i = 2; i < widths.length; i++) if (widths[i] > widths[widest]) widest = i;
    if (widths[widest] <= 4) break; // can't shrink any further, let the terminal wrap
    widths[widest]--;
  }
  return widths;
}

function showTable(arr) {
  if (!arr.length) return console.log(colors.cyan("0 entries"));

  const rows = arr.map((obj) => COLUMNS.map((col) => clean(obj[col])));
  const widths = COLUMNS.map((col, i) => Math.max(col.length, ...rows.map((r) => width(r[i]) || 1)));
  fitWidths(widths, process.stdout.columns || Infinity);

  const line = (l, m, r) => colors.gray(l + widths.map((w) => "─".repeat(w + 2)).join(m) + r);
  const bar = colors.gray("│");
  const row = (cells) => bar + cells.map((c) => " " + c + " ").join(bar) + bar;

  const out = [line("╭", "┬", "╮"), row(COLUMNS.map((col, i) => colors.bold.cyan(pad(col.toUpperCase(), widths[i])))), line("├", "┼", "┤")];
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
  out.push(colors.gray(" " + arr.length + (arr.length === 1 ? " entry" : " entries")));
  console.log(out.join("\n"));
}

// id: exact match, other fields: case-insensitive "contains"
function filter(arr, query) {
  const keys = Object.keys(query);
  return arr.filter((obj) =>
    keys.every((key) => {
      if (key === "id") return String(obj.id) === String(query.id).trim();
      return String(obj[key] ?? "").toLowerCase().includes(String(query[key]).toLowerCase());
    })
  );
}

function copyEntry(entry, db, key) {
  let password;
  try {
    password = decrypt(entry.password, key);
  } catch (err) {
    console.error(colors.red("Couldn't decrypt password of entry #" + entry.id + " (empty or damaged)"));
    return process.exit(1);
  }

  if (isAndroid()) {
    console.log(colors.green(password));
    return process.exit(0);
  }

  copyToClipboard(password, (err, seconds) => {
    if (err) {
      console.error(colors.red("Couldn't copy to clipboard (is xclip installed on linux?)"), err.message);
      return process.exit(1);
    }
    console.log(colors.cyan("Copied password of entry #" + entry.id + " to clipboard" + (seconds ? ", clears in " + seconds + "s" : "")));
    process.exit(0);
  });
}

function getEntry(db, query, opts, key) {
  if (!Object.keys(query).length) return showTable(db.accounts); // show all table

  const filteredEntries = filter(db.accounts, query);
  showTable(filteredEntries); // show matched items

  const action = opts.update ? updateEntry : opts.delete ? deleteEntry : opts.copy ? copyEntry : null;
  if (!action || !filteredEntries.length) return;
  if (filteredEntries.length > 1) return console.log(colors.yellow("Multiple entries matched, narrow it down (e.g. --id <id>)"));
  action(filteredEntries[0], db, key);
}

module.exports = getEntry;
