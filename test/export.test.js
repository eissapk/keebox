// run: npm test  (or: node --test)
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { encrypt } = require("../utils");
const { toCsv } = require("../utils/csv");
const { entriesToCsv } = require("../options/export");

describe("toCsv", () => {
  test("plain fields stay unquoted, rows end with CRLF", () => {
    assert.equal(toCsv([["a", "b"], [1, ""]]), "a,b\r\n1,\r\n");
  });

  test("quotes fields with commas, quotes and line breaks", () => {
    assert.equal(toCsv([['a,b', 'say "hi"', "l1\nl2", "x\ry"]]), '"a,b","say ""hi""","l1\nl2","x\ry"\r\n');
  });

  test("keeps leading = + - @ as-is", () => {
    assert.equal(toCsv([["=1+1", "-x", "@y"]]), "=1+1,-x,@y\r\n");
  });

  test("null / undefined become empty fields", () => {
    assert.equal(toCsv([[null, undefined, 0]]), ",,0\r\n");
  });
});

describe("entriesToCsv", () => {
  const key = crypto.randomBytes(32);
  const entry = {
    id: 1, name: "github", url: "github.com", username: "foo",
    login: encrypt("foo@mail.com", key), notes: encrypt("2FA, phone", key), password: encrypt('p"w,1', key),
    created: "2026-01-01T00:00:00.000Z", updated: "2026-01-02T00:00:00.000Z",
  };

  test("decrypts secrets into the right columns", () => {
    const csv = entriesToCsv([entry, { id: 2, name: "x", url: "", username: "", login: "", notes: "", password: encrypt("p", key) }], key);
    assert.equal(
      csv,
      "id,name,url,username,login,notes,password,created,updated\r\n" +
        '1,github,github.com,foo,foo@mail.com,"2FA, phone","p""w,1",2026-01-01T00:00:00.000Z,2026-01-02T00:00:00.000Z\r\n' +
        "2,x,,,,,p,,\r\n"
    );
  });

  test("returns null with a wrong key (nothing partial)", () => {
    const exitCode = process.exitCode;
    const error = console.error;
    console.error = () => {};
    try {
      assert.equal(entriesToCsv([entry], crypto.randomBytes(32)), null);
    } finally {
      console.error = error;
      process.exitCode = exitCode;
    }
  });
});
