const { askPassword, confirm, prompt, saveOrReport, dbPath, colors, makeRecovery, recover, checkPhrase, normalizePhrase, createMaster } = require("../utils");

// create (or replace) the 12-word recovery phrase: locks the vault key with it into db.json, shows it once
async function createRecovery(db, askKey) {
  const key = await askKey();
  if (!key) return;
  if (db.recovery && !(await confirm("A recovery phrase already exists, the old one will stop working. " + colors.yellow("Replace") + " it"))) return;

  const { phrase, recovery } = makeRecovery(key);
  const old = db.recovery;
  db.recovery = recovery;
  if (!saveOrReport(dbPath, db, colors.green("[+] Saved recovery phrase lock to db.json"), "Error while saving recovery phrase!")) {
    db.recovery = old;
    return void (process.exitCode = 1);
  }

  console.log(colors.yellow("\nWrite these 12 words down (in order) and keep them offline. They are shown only once."));
  console.log(colors.yellow("Anyone with them + db.json can read every account.\n"));
  console.log(formatPhrase(phrase));
  console.log(colors.gray("\n(db.json.bak still holds the previous recovery lock until the next save)"));

  // make sure what's on paper is right, a typo there would only be found when it's needed
  const { typed } = await prompt([{ type: "input", name: "typed", message: "Type the 12 words back to confirm you wrote them down: " }]);
  if (normalizePhrase(typed) === phrase) return console.log(colors.green("[+] Recovery phrase confirmed. Clear your terminal (e.g. 'clear') so it isn't left on screen."));
  process.exitCode = 1;
  console.log(colors.red("Doesn't match what was shown.") + " The new phrase is saved anyway, check your copy or run 'recovery' again to get a new one.");
}

// "word1 ... word12" -> numbered words in 3 columns
function formatPhrase(phrase) {
  const words = phrase.split(" ");
  const cell = (i) => (String(i + 1).padStart(2) + ". " + words[i]).padEnd(16);
  const rows = [];
  for (let r = 0; r < 4; r++) rows.push("  " + [r, r + 4, r + 8].map(cell).join(" ").trimEnd());
  return colors.bold(rows.join("\n"));
}

// recovery phrase -> vault key -> new master password (rewrites credentials.json). For a lost credentials.json or a forgotten master password.
async function recoverVault(db, cred) {
  if (!db.recovery) {
    process.exitCode = 1;
    return console.error(colors.red("db.json has no recovery phrase (restore credentials.json.bak, or db.json.bak if it had one)"));
  }
  const phrase = await askPassword("RECOVERY PHRASE (12 words): ");
  const problem = checkPhrase(phrase);
  if (problem) {
    process.exitCode = 1;
    return console.error(colors.red("Invalid recovery phrase: " + problem));
  }
  const key = recover(phrase, db.recovery);
  if (!key) {
    process.exitCode = 1;
    return console.error(colors.red("Wrong recovery phrase!"));
  }
  console.log(colors.green("[+] Vault unlocked with the recovery phrase"));
  // same vault key, so db.json and the recovery phrase keep working as they are
  if (!(await createMaster(cred, key, "New MASTER PASSWORD: "))) process.exitCode = 1;
}

module.exports = { createRecovery, recoverVault, formatPhrase };
