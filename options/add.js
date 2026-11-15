const { askPassword, encrypt, decryptField, saveOrReport, nextEntryId, dbPath, SECRET_FIELDS, log } = require("../utils");

async function addEntry(db, entry, key) {
  const entryExists = db.accounts.some((obj) => ["name", "url", "username"].every((f) => entry[f] == obj[f]) && entry.login == decryptField(obj, "login", key));
  if (entryExists) return log.warn("Entry exists!");

  SECRET_FIELDS.forEach((f) => (entry[f] = entry[f] && encrypt(entry[f], key)));
  entry.password = encrypt(await askPassword("Add password:"), key);
  entry.id = nextEntryId(db.accounts);
  entry.created = new Date().toISOString();
  entry.updated = entry.created;
  db.accounts.push(entry); // push new entry
  saveOrReport(dbPath, db, "Added entry #" + entry.id, "Error while adding entry!", "added");
}

module.exports = addEntry;
