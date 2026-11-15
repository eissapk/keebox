#!/usr/bin/env node
const { mkPass, askPassword, loadData, copyOrPrint, run, FIELDS, SECRET_FIELDS, log, hasMaster, unlock, createMaster, changeMaster, parseArgs } = require("../utils");
const crypto = require("crypto");
const pkgJSON = require("../package.json");
const { getEntry, addEntry, exportEntries, importEntries, checkDb, createRecovery, recoverVault } = require("../options");

run(main);

async function main() {
  // connect to db
  const data = loadData();
  if (!data) return;
  const { db, cred } = data;

  const parsed = parseArgs(process.argv.slice(2), {
    version: pkgJSON.version,
    description: "KeeBox CLI Tool (" + pkgJSON.version + ")",
    options: [
      ["--id <id>", "Include account id - use it with 'get/add' commands"],
      ["--name <name>", "Include account name - use it with 'get/add' commands"],
      ["--url <url>", "Include account url - use it with 'get/add' commands"],
      ["--username <username>", "Include account username - use it with 'get/add' commands"],
      ["--login <login>", "Include account login (encrypted) - use it with 'add' command"],
      ["--notes <notes>", "Include account notes (encrypted) - use it with 'add' command"],
      ["--cp", "Copy account password to clipboard - use it with 'get' command"],
      ["--show", "Show account login/notes - use it with 'get' command"],
      ["--edit", "Update account in db - use it with 'get' command"],
      ["--rm", "Delete account in db - use it with 'get' command"],
      ["--size <size>", "Password length - use it with 'make' command"],
      ["--out <file>", "CSV file to write (default: keebox-export-<date>.csv) - use it with 'export' command"],
      ["--file <file>", "CSV file to read (columns: name,password + optional url,username,login,notes,created,updated) - use it with 'import' command"],
    ],
    commands: { add: "Add account", get: "display account(s)", make: "Generate a password", export: "Export account(s) as decrypted CSV (filter with --id/--name/...)", import: "Import account(s) from a CSV file (e.g. one made by 'export')", check: "Damage check: find accounts that are broken or can't be decrypted (changes nothing)", recovery: "Create (or replace) the 12-word recovery phrase", recover: "Lost credentials.json / forgot the master password: unlock with the recovery phrase and set a new master password", master: "Create or change the master password (accounts and recovery phrase keep working)" },
  });
  if (parsed) await { add, get, make, export: exportCsv, import: importCsv, check, recovery, recover, master }[parsed.command](parsed.opts, db, cred);
}

// ask master password -> vault key, or null
async function askMaster(cred, db) {
  if (!hasMaster(cred)) {
    // a new vault key would make the existing accounts unreadable
    if (db.accounts.length || db.recovery) {
      log.error("credentials.json is missing or has no master password, but db.json has data.");
      log.warnErr("Run 'recover' with your recovery phrase, or restore credentials.json.bak");
      return null;
    }
    log.warn("No MASTER PASSWORD yet, let's create one.");
    const key = await createMaster(cred, crypto.randomBytes(32));
    if (key) log.hint("Tip: run 'recovery' to create a 12-word recovery phrase, in case credentials.json is lost");
    return key;
  }
  const key = unlock((await askPassword("MASTER PASSWORD:")).trim(), cred);
  if (!key) log.error("Wrong password!");
  return key;
}

async function add(opts, db, cred) {
  for (const f of ["name", "url", "username"]) if (!opts[f]) return log.error("Missing --" + f + " argument!");
  const entry = {};
  FIELDS.forEach((f) => (entry[f] = opts[f] || ""));

  const key = await askMaster(cred, db);
  if (key) await addEntry(db, entry, key);
}

async function get(opts, db, cred) {
  for (const f of SECRET_FIELDS) if (opts[f]) return log.error("Can't search by --" + f + ", it's encrypted (read it with --show)");
  const query = {};
  ["id", ...FIELDS].forEach((f) => opts[f] && (query[f] = opts[f]));

  const key = await askMaster(cred, db);
  if (key) await getEntry(db, query, opts, key);
}

async function make(opts) {
  if (!opts.size) return log.error("Missing --size argument!");
  const length = Number(opts.size);
  if (!Number.isInteger(length) || length < 4 || length > 1024) return log.error("--size must be a number between 4 and 1024");
  await copyOrPrint(mkPass(length), "", true);
}

async function exportCsv(opts, db, cred) {
  for (const f of SECRET_FIELDS) if (opts[f]) return log.error("Can't filter by --" + f + ", it's encrypted");
  const query = {};
  ["id", ...FIELDS].forEach((f) => opts[f] && (query[f] = opts[f]));
  const file = opts.out || "keebox-export-" + new Date().toISOString().slice(0, 10) + ".csv";
  await exportEntries(db, query, file, () => askMaster(cred, db));
}

async function importCsv(opts, db, cred) {
  if (!opts.file) return log.error("Missing --file argument!");
  await importEntries(db, opts.file, () => askMaster(cred, db));
}

async function check(opts, db, cred) {
  await checkDb(db, cred, async () => {
    const key = unlock((await askPassword("MASTER PASSWORD:")).trim(), cred);
    if (!key) log.error("Wrong password!");
    return key;
  });
}

async function recovery(opts, db, cred) {
  await createRecovery(db, () => askMaster(cred, db));
}

async function recover(opts, db, cred) {
  await recoverVault(db, cred);
}

async function master(opts, db, cred) {
  await changeMaster(db, cred);
}
