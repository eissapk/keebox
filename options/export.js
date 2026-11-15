const fs = require("fs");
const path = require("path");
const { confirm, decryptField, filterEntries, colors, FIELDS, SECRET_FIELDS } = require("../utils");
const { toCsv } = require("../utils/csv");

const COLUMNS = ["id", ...FIELDS, "password", "created", "updated"];

// entries -> csv text with every secret decrypted, or null if any field couldn't be decrypted (error already printed)
function entriesToCsv(entries, key) {
  const rows = [COLUMNS];
  for (const entry of entries) {
    const row = [];
    for (const col of COLUMNS) {
      const value = col === "password" || SECRET_FIELDS.includes(col) ? decryptField(entry, col, key) : entry[col];
      if (value === null) return null;
      row.push(value);
    }
    rows.push(row);
  }
  return toCsv(rows);
}

// ask before overwriting `file` -> true when it's ok to write
async function canWrite(file) {
  if (!fs.existsSync(file)) return true;
  return confirm(file + " exists, " + colors.yellow("overwrite") + " it");
}

// write the decrypted entries (all, or the ones matching `query`) to `file`, readable by the owner only
async function exportEntries(db, query, file, askKey) {
  const entries = Object.keys(query).length ? filterEntries(db.accounts, query) : db.accounts;
  if (!entries.length) return console.log(colors.yellow("No entries to export"));

  file = path.resolve(file);
  if (!(await canWrite(file))) return;

  const key = await askKey();
  if (!key) return;
  const csv = entriesToCsv(entries, key);
  if (csv === null) return console.error(colors.red("Export aborted, nothing written"));

  try {
    fs.writeFileSync(file, csv, { mode: 0o600 });
    fs.chmodSync(file, 0o600); // mode only applies to new files
  } catch (err) {
    process.exitCode = 1;
    return console.error(colors.red("Error while exporting!"), err);
  }
  console.log(colors.green("[+] Exported " + entries.length + " entr" + (entries.length === 1 ? "y" : "ies") + " to " + file));
  console.log(colors.yellow("This file is NOT encrypted, delete it when you're done with it."));
}

module.exports = exportEntries;
module.exports.entriesToCsv = entriesToCsv;
