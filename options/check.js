const fs = require("fs");
const { decrypt, isEncrypted, hasMaster, entryLabel, parseDb, dbPath, log, FIELDS, SECRET_FIELDS } = require("../utils");

const ENCRYPTED = ["password", ...SECRET_FIELDS];

// one entry -> list of problems ([] = healthy). Without `key` only the structure is checked (no decryption).
function checkEntry(entry, key) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return ["not an account object"];
  const problems = [];
  if (!Number.isInteger(entry.id) || entry.id < 1) problems.push("bad id (" + JSON.stringify(entry.id) + ")");
  if (typeof entry.name !== "string" || !entry.name.trim()) problems.push("name is empty");
  for (const f of FIELDS) if (entry[f] != null && typeof entry[f] !== "string") problems.push(f + " isn't text");
  if (!entry.password) problems.push("password is empty");

  for (const f of ENCRYPTED) {
    if (!entry[f] || typeof entry[f] !== "string") continue;
    if (!isEncrypted(entry[f])) problems.push(f + " isn't encrypted (unknown format)");
    else if (key && !canDecrypt(entry[f], key)) problems.push(f + " can't be decrypted (damaged)");
  }
  for (const f of ["created", "updated"]) if (entry[f] && isNaN(Date.parse(entry[f]))) problems.push(f + " isn't a valid date");
  return problems;
}

function canDecrypt(value, key) {
  try {
    decrypt(value, key);
    return true;
  } catch (err) {
    return false;
  }
}

// whole db -> [{ entry, problems }] for the damaged entries only (also catches duplicate ids)
function checkEntries(db, key) {
  const seen = new Map(); // id -> count
  db.forEach((e) => e && e.id != null && seen.set(e.id, (seen.get(e.id) || 0) + 1));
  return db
    .map((entry) => {
      const problems = checkEntry(entry, key);
      if (entry && seen.get(entry.id) > 1) problems.push("duplicate id (" + seen.get(entry.id) + " entries use #" + entry.id + ")");
      return { entry, problems };
    })
    .filter((r) => r.problems.length);
}

// a locked vault key { salt, n, key } (credentials.json or db.json "recovery") -> list of problems, prefixed with `label`
function checkLock(lock, label) {
  const problems = [];
  if (typeof lock.salt !== "string" || !/^[0-9a-f]{32}$/.test(lock.salt)) problems.push(label + ": bad salt");
  if (!Number.isInteger(lock.n) || lock.n < 2 || (lock.n & (lock.n - 1)) !== 0) problems.push(label + ": bad n (must be a power of 2)");
  if (!isEncrypted(lock.key)) problems.push(label + ": key isn't encrypted (unknown format)");
  return problems;
}

// credentials.json -> list of problems. `accounts` tells whether a missing master password is a problem.
function checkCredentials(cred, accounts) {
  if (!hasMaster(cred)) {
    const hasSecrets = accounts.some((e) => e && ENCRYPTED.some((f) => isEncrypted(e[f])));
    return hasSecrets ? ["credentials.json has no master password, but db.json has encrypted entries (run 'recover' with your recovery phrase, or restore credentials.json.bak)"] : [];
  }
  return checkLock(cred, "credentials.json");
}

// db.json "recovery" -> list of problems (none when there's no recovery phrase)
function checkRecovery(recovery) {
  if (recovery == null) return [];
  if (typeof recovery !== "object" || Array.isArray(recovery)) return ["db.json: recovery isn't an object"];
  return checkLock(recovery, "db.json recovery");
}

// accounts of db.json.bak, or null
function loadBackup(file = dbPath + ".bak") {
  try {
    return parseDb(JSON.parse(fs.readFileSync(file, "utf8"))).accounts;
  } catch (err) {
    return null;
  }
}

// id of a damaged entry -> true when db.json.bak has a healthy copy of it
function healthyInBackup(entry, backup, key) {
  if (!backup || !entry || entry.id == null) return false;
  const copies = backup.filter((e) => e && e.id === entry.id);
  return copies.length === 1 && checkEntry(copies[0], key).length === 0;
}

// read-only: print every damaged entry + credentials/recovery problem. askKey() -> vault key, or null (wrong password)
async function checkDb(db, cred, askKey) {
  const { accounts } = db;
  const credProblems = checkCredentials(cred, accounts);
  const recoveryProblems = checkRecovery(db.recovery);
  [...credProblems, ...recoveryProblems].forEach((p) => log.problem(p));
  if (db.recovery == null && accounts.length) log.hint("No recovery phrase yet, create one with 'recovery'");

  let key = null;
  if (hasMaster(cred) && !credProblems.length) {
    key = await askKey();
    if (!key) return void (process.exitCode = 1);
  } else {
    log.warn("Can't unlock the vault, checking structure only (no decryption)");
  }

  const damaged = checkEntries(accounts, key);
  const backup = damaged.length ? loadBackup() : null;
  for (const { entry, problems } of damaged) {
    const label = entry && typeof entry === "object" ? entryLabel(entry) : JSON.stringify(entry);
    log.problem(label + ": " + problems.join(", "));
    if (key && healthyInBackup(entry, backup, key)) log.hint("    a healthy copy is in db.json.bak");
  }

  const total = accounts.length + " entr" + (accounts.length === 1 ? "y" : "ies") + " checked";
  if (!damaged.length && !credProblems.length && !recoveryProblems.length) return log.ok(total + ", no damage found" + (key ? "" : " (structure only)"));
  process.exitCode = 1;
  const notes = (credProblems.length ? ", credentials.json damaged" : "") + (recoveryProblems.length ? ", recovery damaged (make a new one with 'recovery')" : "");
  log.warn(total + ", " + damaged.length + " damaged" + notes);
  log.hint("Fix with 'get --id <id> --edit' / '--rm', or restore from db.json.bak / credentials.json.bak");
}

module.exports = checkDb;
module.exports.checkEntry = checkEntry;
module.exports.checkEntries = checkEntries;
module.exports.checkCredentials = checkCredentials;
module.exports.checkRecovery = checkRecovery;
