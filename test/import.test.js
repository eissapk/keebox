// run: npm test  (or: node --test)
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { toCsv, parseCsv } = require("../utils/csv");
const { rowsToRecords } = require("../options/import");

describe("parseCsv", () => {
  test("round-trips toCsv output", () => {
    const rows = [["id", "notes", "password"], ["1", 'a, "b"\nline 2', "=x"], ["2", "", "-y"], ["3", "\r\n", '"']];
    assert.deepEqual(parseCsv(toCsv(rows)), rows);
  });

  test("accepts LF, BOM, no trailing newline, skips blank lines", () => {
    assert.deepEqual(parseCsv("﻿a,b\n\n1,2\n\n3,"), [["a", "b"], ["1", "2"], ["3", ""]]);
  });

  test("empty quoted fields", () => {
    assert.deepEqual(parseCsv('"",x,""\r\n'), [["", "x", ""]]);
  });

  test("throws on an unclosed quote or text after a closing quote", () => {
    assert.throws(() => parseCsv('a\n"b,c\n'), /unclosed quote \(line 2\)/);
    assert.throws(() => parseCsv('"a"b,c\n'), /after closing quote/);
  });
});

describe("rowsToRecords", () => {
  test("maps columns by header name, any order / case, ignores unknown ones", () => {
    const { records, errors } = rowsToRecords([["Password", "ID", " Name ", "extra"], ["pw", "7", " github ", "?"]]);
    assert.deepEqual(errors, []);
    assert.deepEqual(records, [{ password: "pw", id: "7", name: "github", extra: "?" }]);
  });

  test("requires name and password columns", () => {
    assert.match(rowsToRecords([["name", "url"], ["a", "b"]]).errors[0], /missing column\(s\): password/);
    assert.match(rowsToRecords([]).errors[0], /empty/);
  });

  test("reports rows with a wrong column count or an empty name", () => {
    const { errors } = rowsToRecords([["name", "password"], ["a"], [" ", "pw"], ["ok", "pw"]]);
    assert.deepEqual(errors, ["row 1: has 1 columns, header has 2", "row 2: name is empty"]);
  });
});
