// Vault key handling:
// - one random 256-bit "vault key" encrypts every entry password (see utils.encrypt)
// - credentials.json holds that vault key, encrypted with a key derived
//   from the master password (scrypt + random salt): { salt, n, key }
// - db.json "recovery" holds the same vault key, locked the same way with a 12-word
//   recovery phrase instead of the master password, so losing credentials.json
//   (or forgetting the master password) isn't fatal
const crypto = require("crypto");
const { encrypt, decrypt } = require("./index");
const { newPhrase, normalizePhrase } = require("./mnemonic");

const SCRYPT_N = 32768; // ~100ms on a laptop, slows down brute force

function deriveKey(password, saltHex, n) {
  return crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 32, { N: n, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

// master password + vault key -> credentials object { salt, n, key }
function lockVault(password, vaultKey) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, n: SCRYPT_N, key: encrypt(vaultKey.toString("hex"), deriveKey(password, salt, SCRYPT_N)) };
}

function hasMaster(cred) {
  return Boolean(cred.key);
}

// master password -> vault key (or null if wrong / no master yet)
function unlock(password, cred) {
  if (!hasMaster(cred)) return null;
  try {
    return Buffer.from(decrypt(cred.key, deriveKey(password, cred.salt, cred.n)), "hex");
  } catch (err) {
    return null; // wrong password
  }
}

// vault key -> { phrase, recovery }: a new 12-word phrase + the vault key locked with it (db.json "recovery")
function makeRecovery(vaultKey) {
  const phrase = newPhrase();
  return { phrase, recovery: lockVault(phrase, vaultKey) };
}

// recovery phrase + db.json "recovery" -> vault key, or null (wrong phrase / no recovery). Spacing and case don't matter.
function recover(phrase, recovery) {
  if (!recovery) return null;
  return unlock(normalizePhrase(phrase), recovery);
}

module.exports = { lockVault, hasMaster, unlock, makeRecovery, recover };
