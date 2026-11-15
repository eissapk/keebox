const { confirm, saveOrReport, entryLabel, dbPath, colors } = require("../utils");

async function deleteEntry(entry, db) {
  const label = entryLabel(entry);
  if (!(await confirm("Entry " + label + " will be " + colors.yellow("deleted") + ", Are you sure"))) return;
  db.accounts.splice(db.accounts.findIndex((obj) => obj.id == entry.id), 1);
  saveOrReport(dbPath, db, colors.yellow("[-] Deleted entry " + label), "Error while deleting entry!");
}

module.exports = deleteEntry;
