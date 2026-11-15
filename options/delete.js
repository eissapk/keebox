const { confirm, saveOrReport, entryLabel, dbPath, colors } = require("../utils");

async function deleteEntry(entry, db) {
  const label = entryLabel(entry);
  if (!(await confirm("Entry " + label + " will be " + colors.red("deleted") + ", Are you sure"))) return;
  db.accounts.splice(db.accounts.findIndex((obj) => obj.id == entry.id), 1);
  saveOrReport(dbPath, db, "Deleted entry " + label, "Error while deleting entry!", "removed");
}

module.exports = deleteEntry;
