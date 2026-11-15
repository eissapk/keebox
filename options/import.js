const fs = require("fs");
const path = require("path");
const { confirm, encrypt, decryptField, saveOrReport, nextEntryId, dbPath, log, FIELDS, SECRET_FIELDS } = require("../utils");
const { parseCsv } = require("../utils/csv");

const REQUIRED = ["name", "password"];

// csv rows (first = header) -> { records, errors }. Columns are matched by header name (any order, case-insensitive);
// unknown columns (e.g. "id") are ignored, missing optional ones are empty.
function rowsToRecords(rows) {
  if (!rows.length) return { records: [], errors: ["file is empty"] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) return { records: [], errors: ["missing column(s): " + missing.join(", ") + " (header: " + rows[0].join(",") + ")"] };

  const records = [];
  const errors = [];
  rows.slice(1).forEach((row, i) => {
    const at = "row " + (i + 1) + ": ";
    if (row.length !== header.length) return errors.push(at + "has " + row.length + " columns, header has " + header.length);
    const rec = {};
    header.forEach((h, j) => (rec[h] = row[j]));
    rec.name = rec.name.trim();
    if (!rec.name) return errors.push(at + "name is empty");
    records.push(rec);
  });
  return { records, errors };
}

// valid date -> ISO string, else null
function isoDate(value) {
  const t = Date.parse(value);
  return value && !isNaN(t) ? new Date(t).toISOString() : null;
}

// "same account" like `add`: name + url + username + login
function sameKey(e) {
  return JSON.stringify(["name", "url", "username", "login"].map((f) => e[f] || ""));
}

async function importEntries(db, file, askKey) {
  file = path.resolve(file);
  let rows;
  try {
    rows = parseCsv(fs.readFileSync(file, "utf8"));
  } catch (err) {
    process.exitCode = 1;
    return log.error("Couldn't read " + file + ": " + err.message);
  }
  const { records, errors } = rowsToRecords(rows);
  if (errors.length) {
    process.exitCode = 1;
    errors.forEach((e) => log.problem(e));
    return log.error("Import aborted, nothing changed");
  }
  if (!records.length) return log.warn("No entries in " + file);

  const key = await askKey();
  if (!key) return;

  // accounts already in db (login decrypted), plus the ones added from this file
  const seen = new Set();
  for (const e of db.accounts) {
    const login = decryptField(e, "login", key);
    if (login === null) return log.error("Import aborted, fix or delete entry #" + e.id + " first");
    seen.add(sameKey({ ...e, login }));
  }
  const fresh = records.filter((r) => !seen.has(sameKey(r)) && seen.add(sameKey(r)));
  const skipped = records.length - fresh.length;

  const note = skipped ? " (" + skipped + " already in db, skipped)" : "";
  if (!fresh.length) return log.warn("Nothing to import" + note);
  if (!(await confirm("Import " + fresh.length + " entr" + (fresh.length === 1 ? "y" : "ies") + note))) return;

  const now = new Date().toISOString();
  let id = nextEntryId(db.accounts);
  for (const r of fresh) {
    const entry = { id: id++ };
    FIELDS.forEach((f) => (entry[f] = r[f] || ""));
    SECRET_FIELDS.forEach((f) => (entry[f] = entry[f] && encrypt(entry[f], key)));
    entry.password = encrypt(r.password, key);
    entry.created = isoDate(r.created) || now;
    entry.updated = isoDate(r.updated) || entry.created;
    db.accounts.push(entry);
  }
  saveOrReport(dbPath, db, "Imported " + fresh.length + " entr" + (fresh.length === 1 ? "y" : "ies") + note, "Error while importing!", "added");
}

module.exports = importEntries;
module.exports.rowsToRecords = rowsToRecords;
