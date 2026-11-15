// RFC 4180 CSV: fields with a comma, quote or line break are quoted ("" for a quote), rows end with CRLF.
// Values are written as-is (no spreadsheet formula escaping), so passwords like "=abc" or "-x" survive a re-import.
function csvField(value) {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// rows: array of arrays -> csv text
function toCsv(rows) {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

// csv text -> array of rows (arrays of strings). Accepts CRLF or LF, a leading BOM, quoted fields with
// "" and line breaks inside; skips blank lines. Throws on an unclosed quote or text right after a closing quote.
function parseCsv(text) {
  text = String(text).replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let line = 1;
  let i = 0;
  const endField = () => (row.push(field), (field = ""));
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== "") rows.push(row); // skip blank lines
    row = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' && field === "") {
      const start = line;
      i++;
      for (;;) {
        if (i >= text.length) throw new Error("unclosed quote (line " + start + ")");
        if (text[i] === '"') {
          if (text[i + 1] === '"') (field += '"'), (i += 2);
          else break;
        } else {
          if (text[i] === "\n") line++;
          field += text[i++];
        }
      }
      i++; // closing quote
      if (i < text.length && !/[,\r\n]/.test(text[i])) throw new Error("unexpected text after closing quote (line " + line + ")");
      continue;
    }
    if (ch === ",") endField();
    else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
      line++;
    } else field += ch;
    i++;
  }
  if (field !== "" || row.length) endRow();
  return rows;
}

module.exports = { toCsv, parseCsv };
