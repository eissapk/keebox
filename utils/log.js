// one look for every message the CLI prints (same as the website terminal):
//   ✓ done            green   (log.ok)
//   [+] Added ...     green   (log.added)       [+] Updated ...  amber (log.updated)
//   [-] Deleted ...   amber   (log.removed)     [!] damaged ...  red   (log.problem)
//   ! careful ...     amber   (log.warn)        ✗ failed ...     red   (log.error, stderr)
//   dim hints         gray    (log.hint)        plain text             (log.info)
// console.log / console.error are looked up on every call, so tests can swap them.
const colors = require("./colors");

const out =
  (prefix, color, stream = "log") =>
  (msg, ...extra) =>
    console[stream](color((prefix ? prefix + " " : "") + msg), ...extra);

const log = {
  info: out("", colors.text),
  hint: out("", colors.gray),
  ok: out("✓", colors.green),
  added: out("[+]", colors.green),
  updated: out("[+]", colors.amber),
  removed: out("[-]", colors.amber),
  warn: out("!", colors.amber),
  warnErr: out("!", colors.amber, "error"),
  problem: out("[!]", colors.red, "error"),
  error: out("✗", colors.red, "error"),
  // "label: value" pair, e.g. the decrypted notes of an entry
  field: (label, value) => console.log(colors.amber(label + ":") + " " + (value ? colors.text(value) : colors.dim("-"))),
};

module.exports = log;
