// run: npm test  (or: node --test)
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { encrypt, decrypt, lockVault, unlock, makeRecovery, recover, parseDb, toWords, newPhrase, checkPhrase, normalizePhrase } = require("../utils");
const { checkRecovery } = require("../options/check");
const { formatPhrase } = require("../options/recovery");
const WORDS = require("../utils/wordlist");

describe("wordlist", () => {
  test("is the BIP39 English list", () => {
    assert.equal(WORDS.length, 2048);
    assert.equal(new Set(WORDS).size, 2048);
    const hash = crypto.createHash("sha256").update(WORDS.join("\n") + "\n").digest("hex");
    assert.equal(hash, "2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda");
  });
});

describe("mnemonic", () => {
  test("matches the official BIP39 test vectors", () => {
    const vectors = {
      "00000000000000000000000000000000": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      "7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f": "legal winner thank year wave sausage worth useful legal winner thank yellow",
      "80808080808080808080808080808080": "letter advice cage absurd amount doctor acoustic avoid letter advice cage above",
      ffffffffffffffffffffffffffffffff: "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong",
    };
    for (const [hex, phrase] of Object.entries(vectors)) {
      assert.equal(toWords(Buffer.from(hex, "hex")).join(" "), phrase);
      assert.equal(checkPhrase(phrase), null);
    }
  });

  test("new phrases are 12 valid, random words", () => {
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const p = newPhrase();
      assert.equal(p.split(" ").length, 12);
      assert.equal(checkPhrase(p), null);
      seen.add(p);
    }
    assert.equal(seen.size, 200);
  });

  test("accepts any case / spacing", () => {
    const p = newPhrase();
    const messy = "  " + p.toUpperCase().split(" ").join(" \n\t ") + " ";
    assert.equal(checkPhrase(messy), null);
    assert.equal(normalizePhrase(messy), p);
  });

  test("reports wrong word count, unknown words, bad checksum", () => {
    const words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about".split(" ");
    assert.match(checkPhrase(words.slice(1).join(" ")), /needs 12 words, got 11/);
    assert.match(checkPhrase(""), /got 0/);
    assert.match(checkPhrase([...words.slice(0, 11), "abuot"].join(" ")), /unknown word\(s\): abuot/);
    assert.match(checkPhrase([...words.slice(0, 11), "abandon"].join(" ")), /checksum/); // valid word, wrong one
  });

  test("swapping two words is almost always caught", () => {
    let caught = 0;
    for (let i = 0; i < 200; i++) {
      const w = newPhrase().split(" ");
      if (w[0] === w[1]) continue;
      [w[0], w[1]] = [w[1], w[0]];
      if (checkPhrase(w.join(" "))) caught++;
    }
    assert.ok(caught > 150, "caught " + caught + "/200"); // 4-bit checksum: ~15/16
  });
});

describe("recovery (vault key locked with the phrase)", () => {
  // scrypt is slow on purpose, so share one recovery
  const vaultKey = crypto.randomBytes(32);
  const { phrase, recovery } = makeRecovery(vaultKey);
  const entry = encrypt("site password", vaultKey);

  test("recovery -> { salt, n, key } without the vault key in it", () => {
    assert.deepEqual(Object.keys(recovery).sort(), ["key", "n", "salt"]);
    assert.ok(!JSON.stringify(recovery).includes(vaultKey.toString("hex")));
    assert.deepEqual(checkRecovery(recovery), []);
  });

  test("the phrase opens the vault key, even typed messily", () => {
    assert.ok(recover(phrase, recovery).equals(vaultKey));
    assert.ok(recover("  " + phrase.toUpperCase().replace(/ /g, "   ") + "\n", recovery).equals(vaultKey));
  });

  test("wrong phrase / no recovery / tampered recovery -> null", () => {
    assert.equal(recover(newPhrase(), recovery), null);
    assert.equal(recover(phrase, null), null);
    assert.equal(recover(phrase, { ...recovery, key: recovery.key.replace(/.$/, (c) => (c === "0" ? "1" : "0")) }), null);
  });

  test("lost credentials.json: phrase -> vault key -> new master password, old entries still decrypt", () => {
    const key = recover(phrase, recovery);
    const cred = lockVault("brand new master", key); // what 'recover' saves as the new credentials.json
    assert.equal(decrypt(entry, unlock("brand new master", cred)), "site password");
    assert.ok(recover(phrase, recovery).equals(unlock("brand new master", cred))); // phrase keeps working
  });

  test("a new phrase replaces the old one", () => {
    const next = makeRecovery(vaultKey);
    assert.notEqual(next.phrase, phrase);
    assert.equal(recover(phrase, next.recovery), null);
    assert.ok(recover(next.phrase, next.recovery).equals(vaultKey));
  });

  test("checkRecovery finds a damaged recovery", () => {
    assert.deepEqual(checkRecovery(null), []);
    assert.deepEqual(checkRecovery([]), ["db.json: recovery isn't an object"]);
    assert.deepEqual(checkRecovery({ salt: "x", n: 3, key: "x" }), ["db.json recovery: bad salt", "db.json recovery: bad n (must be a power of 2)", "db.json recovery: key isn't encrypted (unknown format)"]);
  });

  test("formatPhrase numbers all 12 words", () => {
    const plain = formatPhrase(phrase).replace(/\x1b\[[0-9;]*m/g, "");
    phrase.split(" ").forEach((w, i) => assert.ok(plain.includes(i + 1 + ". " + w), w));
  });
});

describe("parseDb", () => {
  test("accepts { recovery, accounts }", () => {
    for (const db of [{ recovery: { salt: "s", n: 2, key: "k" }, accounts: [{ id: 1 }] }, { recovery: null, accounts: [] }]) assert.equal(parseDb(db), db);
  });

  test("rejects anything else, including a plain array of accounts", () => {
    const bad = [[], [{ id: 1, name: "a" }], null, {}, { accounts: [] }, { recovery: null }, { recovery: null, accounts: {} }, { recovery: "x", accounts: [] }, "x", 1];
    for (const b of bad) assert.throws(() => parseDb(b), /db.json must be/, JSON.stringify(b));
  });
});
