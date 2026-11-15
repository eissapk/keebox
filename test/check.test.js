// run: npm test  (or: node --test)
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { encrypt, lockVault } = require("../utils");
const { checkEntry, checkEntries, checkCredentials } = require("../options/check");

const key = crypto.randomBytes(32);
const otherKey = crypto.randomBytes(32);
const good = (id, extra = {}) => ({ id, name: "github", url: "github.com", username: "foo", login: encrypt("me", key), notes: "", password: encrypt("pw", key), created: "2026-01-01T00:00:00.000Z", updated: "2026-01-01T00:00:00.000Z", ...extra });

describe("checkEntry", () => {
  test("healthy entry, with and without the key", () => {
    assert.deepEqual(checkEntry(good(1), key), []);
    assert.deepEqual(checkEntry(good(1), null), []);
    assert.deepEqual(checkEntry({ id: 2, name: "old", password: encrypt("pw", key) }, key), []); // before timestamps/secret fields existed
  });

  test("finds values that can't be decrypted (wrong key or flipped byte)", () => {
    const pw = encrypt("pw", key);
    const flipped = pw.slice(0, -1) + (pw.slice(-1) === "0" ? "1" : "0");
    assert.deepEqual(checkEntry(good(1, { password: flipped }), key), ["password can't be decrypted (damaged)"]);
    assert.deepEqual(checkEntry(good(1, { notes: encrypt("n", otherKey) }), key), ["notes can't be decrypted (damaged)"]);
    assert.deepEqual(checkEntry(good(1, { password: flipped }), null), []); // structure only
  });

  test("finds broken structure", () => {
    assert.deepEqual(checkEntry(null, key), ["not an account object"]);
    assert.deepEqual(checkEntry(good("1", { name: " ", password: "", login: "plain", created: "nope" }), key), [
      'bad id ("1")',
      "name is empty",
      "password is empty",
      "login isn't encrypted (unknown format)",
      "created isn't a valid date",
    ]);
  });
});

describe("checkEntries", () => {
  test("returns only damaged entries, flags duplicate ids", () => {
    const damaged = checkEntries([good(1), good(2), good(2), good(3, { password: "x" })], key);
    assert.deepEqual(
      damaged.map((d) => [d.entry.id, d.problems]),
      [
        [2, ["duplicate id (2 entries use #2)"]],
        [2, ["duplicate id (2 entries use #2)"]],
        [3, ["password isn't encrypted (unknown format)"]],
      ]
    );
  });
});

describe("checkCredentials", () => {
  test("healthy credentials", () => {
    assert.deepEqual(checkCredentials(lockVault("master", key), [good(1)]), []);
  });

  test("missing master password is only a problem when db has encrypted entries", () => {
    assert.deepEqual(checkCredentials({}, []), []);
    assert.match(checkCredentials({}, [good(1)])[0], /no master password/);
  });

  test("bad salt / n / key", () => {
    assert.deepEqual(checkCredentials({ salt: "zz", n: 1000, key: "nope" }, []), ["credentials.json: bad salt", "credentials.json: bad n (must be a power of 2)", "credentials.json: key isn't encrypted (unknown format)"]);
  });
});
