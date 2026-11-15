function isAndroid() {
  return require("os").platform() === "android";
}

const colors = require("./colors");
const log = require("./log");
const { FIELDS, SECRET_FIELDS } = require("./fields");
const crypto = require("crypto");
const path = require("path");
const { once } = require("events");
const prompt = require("./prompt");
const drawTable = require("./table");
const parseArgs = require("./cli");

// where db.json + credentials.json live:
// - $KEEBOX_HOME when set
// - ~/.keebox when installed with npm (inside node_modules, which npm wipes on update/uninstall)
// - the project folder otherwise (git clone / portable USB copy)
function dataDir() {
  if (process.env.KEEBOX_HOME) return path.resolve(process.env.KEEBOX_HOME);
  const appDir = path.resolve(__dirname, "..");
  if (appDir.split(path.sep).includes("node_modules")) return path.join(require("os").homedir(), ".keebox");
  return appDir;
}
const dir = dataDir();
const dbPath = path.join(dir, "db.json");
const credPath = path.join(dir, "credentials.json");

// cryptographically secure, exact length, at least one char of each class (length >= 4)
function mkPass(length) {
  const sets = ["abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789", "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"];
  const all = sets.join("");
  const pick = (str) => str[crypto.randomInt(str.length)];
  const chars = sets.map(pick);
  while (chars.length < length) chars.push(pick(all));
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// AES-256-GCM with the vault key -> "iv.tag.data" (no key stored)
function encrypt(text, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), data.toString("hex")].join(".");
}

function decrypt(str, key) {
  if (!isEncrypted(str)) throw new Error("unknown encryption format");
  const [iv, tag, data] = str.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"), { authTagLength: 16 });
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]).toString("utf8");
}

// made by encrypt() ("iv.tag.data")
function isEncrypted(value) {
  return /^[0-9a-f]{24}\.[0-9a-f]{32}\.[0-9a-f]*$/.test(String(value));
}

// decrypt one secret field of an entry -> text ("" if empty), or null after printing the error
function decryptField(entry, field, key) {
  if (!entry[field]) return "";
  try {
    return decrypt(entry[field], key);
  } catch (err) {
    log.error("Couldn't decrypt " + field + " of entry #" + entry.id + " (damaged)");
    process.exitCode = 1;
    return null;
  }
}

// safe write: temp file + fsync + rename (atomic), keeps previous version as <file>.bak
function saveJson(file, data) {
  const fs = require("fs");
  const tmp = file + ".tmp";
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const fd = fs.openSync(tmp, "w", 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(data, null, 2));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  if (fs.existsSync(file)) fs.copyFileSync(file, file + ".bak");
  fs.renameSync(tmp, file);
}

// read json file, create it with `fallback` if missing
function loadJson(file, fallback) {
  const fs = require("fs");
  if (!fs.existsSync(file)) {
    saveJson(file, fallback);
    log.hint("Created " + file);
  }
  return JSON.parse(fs.readFileSync(file).toString());
}

// clipboard commands for this OS: [command, args, stdin encoding]
function clipboardCommands() {
  const env = process.env;
  if (process.platform === "darwin") return { copy: ["pbcopy", []], paste: ["pbpaste", []] };
  if (process.platform === "win32" || env.WSL_DISTRO_NAME) {
    const exe = process.platform === "win32" ? "" : ".exe"; // WSL calls the Windows binaries
    return { copy: ["clip" + exe, [], "utf16le"], paste: ["powershell" + exe, ["-NoProfile", "-Command", "Get-Clipboard"]] };
  }
  if (env.WAYLAND_DISPLAY) return { copy: ["wl-copy", []], paste: ["wl-paste", ["--no-newline"]], clear: ["wl-copy", ["--clear"]] };
  return { copy: ["xclip", ["-selection", "clipboard"]], paste: ["xclip", ["-selection", "clipboard", "-o"]] };
}

// runs in a detached node process (serialized with .toString()), so it must be self-contained
async function clearClipboardLater(cmds, ms) {
  const cp = require("child_process");
  let text = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) text += chunk;
  await require("timers/promises").setTimeout(ms);
  const opts = { windowsHide: true, timeout: 5000 };
  const cur = cp.spawnSync(cmds.paste[0], cmds.paste[1], { ...opts, encoding: "utf8" });
  if (cur.status !== 0 || ![text, text + "\n", text + "\r\n"].includes(cur.stdout)) return; // changed since, leave it
  const clear = cmds.clear || cmds.copy;
  cp.spawnSync(clear[0], clear[1], { ...opts, input: "", stdio: ["pipe", "ignore", "ignore"] });
}

// copy to clipboard, then clear it after `seconds` (only if it still holds the same text)
// -> seconds until it clears (0 = couldn't schedule clearing), throws if copying failed
async function copyToClipboard(text, seconds = 20) {
  const { spawn } = require("child_process");
  const cmds = clipboardCommands();
  const [command, args, encoding] = cmds.copy;

  const child = spawn(command, args, { stdio: ["pipe", "ignore", "ignore"], windowsHide: true });
  child.on("error", () => {}); // reported through once() below
  child.stdin.on("error", () => {});
  child.stdin.end(Buffer.from(String(text), encoding || "utf8"));
  // xclip/wl-copy stay in the background to serve the clipboard, so wait for "exit" (not stdio "close")
  const [code] = await once(child, "exit"); // rejects on "error", e.g. ENOENT: command not installed
  if (code) throw new Error(command + " exited with code " + code);

  try {
    const script = "(" + clearClipboardLater.toString() + ")(" + JSON.stringify(cmds) + "," + seconds * 1000 + ");";
    const clearer = spawn(process.execPath, ["-e", script], { detached: true, stdio: ["pipe", "ignore", "ignore"], windowsHide: true });
    clearer.on("error", () => {});
    clearer.unref();
    clearer.stdin.end(String(text)); // password goes via stdin, not argv
    await once(clearer.stdin, "finish");
    return seconds;
  } catch (err) {
    return 0; // copied, but couldn't schedule clearing
  }
}

// ---- shared app helpers ----

// db.json content -> the same { recovery, accounts } object, or throws when it has another shape
function parseDb(raw) {
  const ok = raw && typeof raw === "object" && !Array.isArray(raw) && "recovery" in raw && (raw.recovery === null || typeof raw.recovery === "object") && Array.isArray(raw.accounts);
  if (!ok) throw new Error('db.json must be { "recovery": null | { salt, n, key }, "accounts": [...] }');
  return raw;
}

// load db.json + credentials.json (created if missing) -> { db, cred }, or null after printing the error
// db = { recovery, accounts }: saving `db` writes the whole db.json
function loadData() {
  try {
    const db = parseDb(loadJson(dbPath, { recovery: null, accounts: [] }));
    const cred = loadJson(credPath, {});
    if (!cred || typeof cred !== "object" || Array.isArray(cred)) throw new Error("credentials.json must be an object");
    return { db, cred };
  } catch (err) {
    log.error("Couldn't connect to db! (backups: db.json.bak, credentials.json.bak)", "\n", err);
    return null;
  }
}

// save, then print `okMsg` with log[kind] ("added", "updated", "removed", "ok") -> true, or print `errMsg` + the error -> false
function saveOrReport(file, data, okMsg, errMsg, kind = "added") {
  try {
    saveJson(file, data);
  } catch (err) {
    log.error(errMsg, err);
    process.exitCode = 1;
    return false;
  }
  log[kind](okMsg);
  return true;
}

// single hidden password prompt -> password
async function askPassword(message) {
  return (await prompt([{ type: "password", name: "password", message }])).password;
}

// yes/no prompt -> true/false
async function confirm(message) {
  return (await prompt([{ type: "confirm", name: "ok", message }])).ok;
}

// run an async entry point: unexpected errors are printed and exit with code 1
function run(main) {
  main().catch((err) => {
    log.error("Unexpected error:", err);
    process.exitCode = 1;
  });
}

// "#3 github (eissa)"
function entryLabel(entry) {
  return "#" + entry.id + " " + entry.name + " (" + entry.username + ")";
}

// copy to the clipboard (auto-cleared), or print it on Android / when copying fails
// what: shown in "Copied <what> to clipboard" (omitted when empty), show: also print the text on success
//   show:  "Copied to clipboard (clears in 20s): <text>"   (text in amber)
//   else:  "✓ Copied password of entry #3 to clipboard, clears in 20s"
async function copyOrPrint(text, what, show) {
  if (isAndroid()) return console.log(colors.amber(text));
  let seconds;
  try {
    seconds = await copyToClipboard(text);
  } catch (err) {
    log.warnErr("Couldn't copy to clipboard (linux needs xclip, or wl-clipboard on Wayland): " + err.message);
    return console.log(colors.amber(text));
  }
  const copied = "Copied " + (what ? what + " " : "") + "to clipboard";
  if (show) return console.log(colors.green(copied + (seconds ? " (clears in " + seconds + "s)" : "") + ":") + " " + colors.amber(text));
  log.ok(copied + (seconds ? ", clears in " + seconds + "s" : ""));
}

// decrypt an entry's password and copy it (or print it, see copyOrPrint)
async function copyEntry(entry, db, key) {
  let password;
  try {
    password = decrypt(entry.password, key);
  } catch (err) {
    log.error("Couldn't decrypt password of entry #" + entry.id + " (empty or damaged)");
    process.exitCode = 1;
    return;
  }
  await copyOrPrint(password, "password of entry #" + entry.id);
}

// print an entry's secret fields (not the password)
async function showEntry(entry, db, key) {
  for (const f of SECRET_FIELDS) {
    const value = decryptField(entry, f, key);
    if (value === null) return;
    log.field(f, value);
  }
}

// next free entry id: highest id + 1 (1 for an empty db)
function nextEntryId(entries) {
  return entries.reduce((max, obj) => Math.max(max, Number(obj.id) || 0), 0) + 1;
}

// id: exact match, other fields: case-insensitive "contains"
function filterEntries(entries, query) {
  const keys = Object.keys(query);
  return entries.filter((obj) =>
    keys.every((key) => {
      if (key === "id") return String(obj.id) === String(query.id).trim();
      return String(obj[key] ?? "")
        .toLowerCase()
        .includes(String(query[key]).toLowerCase());
    })
  );
}

module.exports = {
  dbPath,
  credPath,
  FIELDS,
  parseDb,
  SECRET_FIELDS,
  loadData,
  saveOrReport,
  askPassword,
  confirm,
  run,
  entryLabel,
  copyOrPrint,
  copyEntry,
  showEntry,
  decryptField,
  nextEntryId,
  filterEntries,
  drawTable,
  prompt,
  mkPass,
  decrypt,
  encrypt,
  isEncrypted,
  colors,
  log,
  parseArgs,
  ...require("./mnemonic"),
};

// vault.js and config.js import from this file at their top, so they load only after module.exports is filled in
// (earlier they'd get an empty object). One per line: config.js needs vault's functions here already.
Object.assign(module.exports, require("./vault"));
Object.assign(module.exports, require("./config"));
