// run: npm test  (or: node --test)
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
// load through utils/index.js: it wires vault.js in at the end (loading vault.js first breaks config.js)
const { encrypt, decrypt, decryptField, mkPass, lockVault, hasMaster, unlock } = require("../utils");

const FORMAT = /^[0-9a-f]{24}\.[0-9a-f]{32}\.[0-9a-f]*$/; // "iv.tag.data"
const newKey = () => crypto.randomBytes(32);

// flip one hex digit of part `i` ("iv" = 0, "tag" = 1, "data" = 2)
function tamper(str, i) {
  const parts = str.split(".");
  const p = parts[i];
  parts[i] = (p[0] === "0" ? "1" : "0") + p.slice(1);
  return parts.join(".");
}

describe("encrypt / decrypt", () => {
  test("round-trips text", () => {
    const key = newKey();
    for (const text of ["hunter2", "", "ünïcødé 🔑 كلمة", "a".repeat(10000), "with.dots.inside"]) {
      assert.equal(decrypt(encrypt(text, key), key), text);
    }
  });

  test('output is "iv.tag.data" hex', () => {
    const out = encrypt("secret", newKey());
    assert.match(out, FORMAT);
    assert.equal(out.split(".")[2].length, "secret".length * 2); // GCM: ciphertext length = plaintext length
  });

  test("ciphertext does not contain the plaintext", () => {
    const text = "plain-text-password";
    const out = encrypt(text, newKey());
    assert.ok(!out.includes(text));
    assert.ok(!out.includes(Buffer.from(text).toString("hex")));
  });

  test("uses a fresh IV every time", () => {
    const key = newKey();
    const a = encrypt("same", key);
    const b = encrypt("same", key);
    assert.notEqual(a, b);
    assert.notEqual(a.split(".")[0], b.split(".")[0]);
  });

  test("wrong key throws", () => {
    const out = encrypt("secret", newKey());
    assert.throws(() => decrypt(out, newKey()));
  });

  test("tampered iv, tag or data throws", () => {
    const key = newKey();
    const out = encrypt("secret", key);
    for (const i of [0, 1, 2]) assert.throws(() => decrypt(tamper(out, i), key), `part ${i}`);
  });

  test("truncated ciphertext throws", () => {
    const key = newKey();
    const out = encrypt("secret", key);
    assert.throws(() => decrypt(out.slice(0, -2), key));
  });

  test("rejects strings that aren't in the encrypt() format", () => {
    const key = newKey();
    for (const bad of ["", "plaintext", "a.b.c", "00.11.22", encrypt("x", key).toUpperCase(), undefined, null]) {
      assert.throws(() => decrypt(bad, key), /unknown encryption format/, String(bad));
    }
  });

  test("rejects keys that aren't 256-bit", () => {
    assert.throws(() => encrypt("x", crypto.randomBytes(16)));
  });
});

describe("decryptField", () => {
  // silences console.error and restores process.exitCode
  function quietly(fn) {
    const { error } = console;
    const code = process.exitCode;
    const logged = [];
    console.error = (...args) => logged.push(args.join(" "));
    try {
      return { result: fn(), exitCode: process.exitCode, logged };
    } finally {
      console.error = error;
      process.exitCode = code;
    }
  }

  test("decrypts a field", () => {
    const key = newKey();
    assert.equal(decryptField({ id: 1, notes: encrypt("my notes", key) }, "notes", key), "my notes");
  });

  test('empty or missing field -> ""', () => {
    const key = newKey();
    assert.equal(decryptField({ id: 1, notes: "" }, "notes", key), "");
    assert.equal(decryptField({ id: 1 }, "notes", key), "");
  });

  test("damaged field -> null, error printed, exit code 1", () => {
    const key = newKey();
    const entry = { id: 7, notes: tamper(encrypt("x", key), 2) };
    const { result, exitCode, logged } = quietly(() => decryptField(entry, "notes", key));
    assert.equal(result, null);
    assert.equal(exitCode, 1);
    assert.match(logged.join("\n"), /notes of entry #7/);
  });
});

describe("mkPass", () => {
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/];

  test("has the exact length", () => {
    for (const n of [4, 5, 8, 16, 32, 64, 128]) assert.equal(mkPass(n).length, n);
  });

  test("always has one char of each class", () => {
    for (let i = 0; i < 500; i++) {
      const p = mkPass(4); // shortest: exactly one of each
      for (const re of classes) assert.match(p, re);
    }
  });

  test("uses only printable ASCII, no spaces", () => {
    for (let i = 0; i < 100; i++) assert.match(mkPass(32), /^[\x21-\x7e]+$/);
  });

  test("doesn't repeat", () => {
    const seen = new Set();
    for (let i = 0; i < 1000; i++) seen.add(mkPass(16));
    assert.equal(seen.size, 1000);
  });

  test("required chars aren't stuck in fixed positions (shuffled)", () => {
    // without the shuffle, position 0 would always be lowercase
    const firsts = new Set();
    for (let i = 0; i < 200; i++) {
      const c = mkPass(4)[0];
      firsts.add(classes.findIndex((re) => re.test(c)));
    }
    assert.equal(firsts.size, 4);
  });
});

describe("vault (master password)", () => {
  // scrypt is slow on purpose (~100ms per call), so share one locked vault
  const password = "correct horse battery staple";
  const vaultKey = newKey();
  const cred = lockVault(password, vaultKey);

  test("lockVault -> { salt, n, key }", () => {
    assert.deepEqual(Object.keys(cred).sort(), ["key", "n", "salt"]);
    assert.match(cred.salt, /^[0-9a-f]{32}$/);
    assert.equal(cred.n, 32768);
    assert.match(cred.key, FORMAT);
    assert.ok(!cred.key.includes(vaultKey.toString("hex")));
  });

  test("right password unlocks the vault key", () => {
    const key = unlock(password, cred);
    assert.ok(Buffer.isBuffer(key));
    assert.ok(key.equals(vaultKey));
  });

  test("wrong password -> null", () => {
    assert.equal(unlock("wrong", cred), null);
    assert.equal(unlock("", cred), null);
    assert.equal(unlock(password + " ", cred), null); // callers trim, unlock itself doesn't
  });

  test("tampered credentials -> null", () => {
    assert.equal(unlock(password, { ...cred, key: tamper(cred.key, 2) }), null);
    assert.equal(unlock(password, { ...cred, salt: tamper(cred.salt, 0) }), null);
    assert.equal(unlock(password, { ...cred, n: 16384 }), null);
  });

  test("re-locking uses a new salt, old and new both open the same key", () => {
    const again = lockVault(password, vaultKey);
    assert.notEqual(again.salt, cred.salt);
    assert.notEqual(again.key, cred.key);
    assert.ok(unlock(password, again).equals(vaultKey));
  });

  test("changing the master password keeps the vault key, so existing entries still decrypt", () => {
    const entry = encrypt("site password", vaultKey);
    const changed = lockVault("new master", unlock(password, cred));
    assert.equal(unlock(password, changed), null);
    assert.equal(decrypt(entry, unlock("new master", changed)), "site password");
  });

  test("hasMaster / unlock before a master password exists", () => {
    assert.equal(hasMaster(cred), true);
    assert.equal(hasMaster({}), false);
    assert.equal(hasMaster({ key: "" }), false);
    assert.equal(unlock(password, {}), null);
  });
});
