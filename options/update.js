const { prompt, confirm, encrypt, saveOrReport, entryLabel, dbPath, FIELDS, SECRET_FIELDS, colors } = require("../utils");

async function updateEntry(entry, db, key) {
  if (!(await confirm("Entry " + entryLabel(entry) + " will be " + colors.yellow("updated") + ", Are you sure"))) return;

  console.log(colors.gray("Enter = keep current value, '-' = clear it"));
  const questions = FIELDS.map((f) => ({ type: "input", name: f, message: "New " + f + " [" + (SECRET_FIELDS.includes(f) && entry[f] ? "***" : entry[f] || "") + "]: " }));
  questions.push({ type: "password", name: "password", message: "New password (Enter = keep): " });

  const answers = await prompt(questions);
  let changed = false;
  FIELDS.forEach((f) => {
    const value = answers[f].trim();
    let next = entry[f];
    if (value === "-" && f !== "name") next = "";
    else if (value !== "" && value !== "-") next = SECRET_FIELDS.includes(f) ? encrypt(value, key) : value; // secrets: new value always counts as a change
    if (next !== entry[f]) changed = true;
    entry[f] = next;
  });
  if (answers.password !== "") {
    entry.password = encrypt(answers.password, key);
    changed = true;
  }
  if (!changed) return console.log(colors.gray("Nothing changed"));
  entry.updated = new Date().toISOString();

  // entry is a reference into db.accounts
  saveOrReport(dbPath, db, colors.yellow("[+] Updated entry #" + entry.id), "Error while updating entry!");
}

module.exports = updateEntry;
