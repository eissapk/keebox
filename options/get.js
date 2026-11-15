const { copyEntry, showEntry, drawTable, filterEntries, log } = require("../utils");

async function getEntry(db, query, opts, key) {
  const { deleteEntry, updateEntry } = require("./index"); // here, not at the top: options/index.js loads this file, so its exports are only ready at call time
  if (!Object.keys(query).length) return drawTable(db.accounts); // show all table

  const filteredEntries = filterEntries(db.accounts, query);
  drawTable(filteredEntries); // show matched items

  const action = opts.edit ? updateEntry : opts.rm ? deleteEntry : opts.cp ? copyEntry : opts.show ? showEntry : null;
  if (!action || !filteredEntries.length) return;
  if (filteredEntries.length > 1) return log.warn("Multiple entries matched, narrow it down (e.g. --id <id>)");
  await action(filteredEntries[0], db, key);
}

module.exports = getEntry;
