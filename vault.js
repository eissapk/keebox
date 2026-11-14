// Vault key handling:
// - one random 256-bit "vault key" encrypts every entry password (see olum.encrypt)
// - each master password has a "slot" in credentials.json holding the vault key,
//   encrypted with a key derived from that master password (scrypt + random salt)
// - old setups (bcrypt hashes + per-entry inline keys) are upgraded on first unlock
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { modulesPath, saveJson, exists, encrypt, decrypt, legacyDecrypt } = require("./olum");
const colors = require(modulesPath + "/colors");

const dbPath = path.resolve(__dirname, "./db.json");
const credPath = path.resolve(__dirname, "./credentials.json");
const SCRYPT_N = 32768; // ~100ms on a laptop, slows down brute force

function deriveKey(password, saltHex, n) {
  return crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 32, { N: n, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function makeSlot(password, vaultKey) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, n: SCRYPT_N, key: encrypt(vaultKey.toString("hex"), deriveKey(password, salt, SCRYPT_N)) };
}

function openSlot(password, slot) {
  try {
    return Buffer.from(decrypt(slot.key, deriveKey(password, slot.salt, slot.n)), "hex");
  } catch (err) {
    return null; // wrong password
  }
}

// -> { index, key } of the slot this password opens, or { index: -1, key: null }
function findSlot(password, cred) {
  const slots = cred.slots || [];
  for (let i = 0; i < slots.length; i++) {
    const key = openSlot(password, slots[i]);
    if (key) return { index: i, key };
  }
  return { index: -1, key: null };
}

function hasMaster(cred) {
  return Boolean((cred.slots && cred.slots.length) || (cred.secrets && cred.secrets.length));
}

// keep the very first pre-upgrade copy (never overwritten)
function backupOnce(file) {
  if (fs.existsSync(file) && !fs.existsSync(file + ".v1.bak")) fs.copyFileSync(file, file + ".v1.bak");
}

// old bcrypt hashes -> slot (only the password typed now can be converted)
function upgradeCredentials(password, cred) {
  backupOnce(credPath);
  const vaultKey = crypto.randomBytes(32);
  const dropped = cred.secrets.length - 1;
  cred.slots = [makeSlot(password, vaultKey)];
  delete cred.secrets;
  saveJson(credPath, cred); // saved BEFORE entries are re-encrypted, so the key is never lost
  console.log(colors.green("[+] Upgraded MASTER PASSWORD to the new encryption."));
  if (dropped > 0) console.log(colors.yellow(dropped + " other MASTER PASSWORD(s) removed, re-add with: node config.js"));
  return vaultKey;
}

// old "iv.key.data" entries -> "v2.iv.tag.data" encrypted with the vault key
function upgradeEntries(db, vaultKey) {
  const old = db.accounts.filter((a) => /^[0-9a-f]{32}\.[0-9a-f]{64}\.[0-9a-f]+$/.test(a.password || "")); // iv.key.data
  if (!old.length) return;
  backupOnce(dbPath);
  let count = 0;
  old.forEach((a) => {
    try {
      a.password = encrypt(legacyDecrypt(a.password), vaultKey);
      count++;
    } catch (err) {
      console.log(colors.red("Couldn't upgrade entry #" + a.id + " (damaged password)"));
    }
  });
  if (!count) return;
  saveJson(dbPath, db);
  fs.copyFileSync(dbPath, dbPath + ".bak"); // don't leave old-format data in db.json.bak
  console.log(colors.green("[+] Upgraded " + count + " entr" + (count > 1 ? "ies" : "y") + " to the new encryption."));
  console.log(colors.yellow("Old-format backup: db.json.v1.bak - it is readable WITHOUT a master password. Check your entries, then delete it."));
}

// master password -> vault key (or null), upgrading old data on the way
function unlock(password, cred, db) {
  let key = findSlot(password, cred).key;
  if (!key && !(cred.slots && cred.slots.length) && cred.secrets && cred.secrets.length && exists(password, cred.secrets)) {
    key = upgradeCredentials(password, cred);
  }
  if (key && db) upgradeEntries(db, key);
  return key;
}

module.exports = { dbPath, credPath, makeSlot, findSlot, hasMaster, unlock };
