function getModulesPath () {
  const os = require("os");
  let currentOs = null;
  ["linux", "android"].includes(os.platform()) ? (currentOs = "linux") : os.platform() == "darwin" ? (currentOs = "mac") : (currentOs = "win");
  return "./node/" + currentOs + "/node_modules";
}
const modulesPath = getModulesPath();
module.exports.modulesPath = modulesPath;

function isAndroid() {
  return require("os").platform() === "android";
}
module.exports.isAndroid = isAndroid;

const inquirer = require(modulesPath + "/inquirer");
const bcrypt = require(modulesPath + "/bcryptjs"); // bcrypt is faster, but we use bcryptjs because it is slow which will make the brute force attack slow also
const crypto = require("crypto");

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

function prompt(data, cb) {
  inquirer
    .prompt(data)
    .then((res) => {
      if (cb) cb(res);
    })
    .catch(console.error);
}

function exists(pwd, secrets) {
  var matched = false;
  for (let i = 0; i < secrets.length; i++) {
    if (bcrypt.compareSync(pwd, secrets[i])) {
      matched = true;
      break;
    }
  }
  return matched;
}

// AES-256-GCM with the vault key -> "v2.iv.tag.data" (no key stored)
function encrypt(text, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return ["v2", iv.toString("hex"), cipher.getAuthTag().toString("hex"), data.toString("hex")].join(".");
}

function decrypt(str, key) {
  const [version, iv, tag, data] = str.split(".");
  if (version !== "v2") return legacyDecrypt(str);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"), { authTagLength: 16 });
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]).toString("utf8");
}

// old format "iv.key.data" (AES-256-CBC, key stored inline) - only used to upgrade old entries
function legacyDecrypt(str) {
  const [iv, key, data] = str.split(".");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key, "hex"), Buffer.from(iv, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]).toString();
}

// safe write: temp file + fsync + rename (atomic), keeps previous version as <file>.bak
function saveJson(file, data) {
  const fs = require("fs");
  const tmp = file + ".tmp";
  const fd = fs.openSync(tmp, "w");
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
    console.log("Created " + file);
  }
  return JSON.parse(fs.readFileSync(file).toString());
}

// copy to clipboard, then clear it after `seconds` (only if it still holds the same text)
function copyToClipboard(text, cb, seconds = 20) {
  const path = require("path");
  const modPath = path.resolve(__dirname, modulesPath, "copy-paste");
  const ncp = require(modPath);
  ncp.copy(text, (err) => {
    if (err) return cb(err);
    const script =
      "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>setTimeout(()=>{" +
      "const ncp=require(" + JSON.stringify(modPath) + ");" +
      "ncp.paste((e,cur)=>{if(!e&&cur===s)ncp.copy('');});" +
      "}," + seconds * 1000 + "));";
    try {
      const child = require("child_process").spawn(process.execPath, ["-e", script], { detached: true, stdio: ["pipe", "ignore", "ignore"], windowsHide: true });
      child.on("error", () => {});
      child.unref();
      child.stdin.end(text, () => cb(null, seconds)); // password goes via stdin, not argv
    } catch (e) {
      cb(null, 0); // copied, but couldn't schedule clearing
    }
  });
}

module.exports.saveJson = saveJson;
module.exports.loadJson = loadJson;
module.exports.copyToClipboard = copyToClipboard;
module.exports.prompt = prompt;
module.exports.mkPass = mkPass;
module.exports.exists = exists;
module.exports.decrypt = decrypt;
module.exports.encrypt = encrypt;
module.exports.legacyDecrypt = legacyDecrypt;
