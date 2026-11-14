const { modulesPath, decrypt, isAndroid, copyToClipboard } = require("./olum");
const colors = require(modulesPath + "/colors");
const deleteEntry = require("./delete");
const updateEntry = require("./update");

function showTable(arr) {
  if (!arr.length) return console.log(colors.cyan("0 Entries"));
  console.table(arr, ["id", "name", "location", "username", "login"]);
  console.log(arr.length >= 2 ? arr.length + " rows" : arr.length + " row");
}

// id: exact match, other fields: case-insensitive "contains"
function filter(arr, query) {
  const keys = Object.keys(query);
  return arr.filter((obj) =>
    keys.every((key) => {
      if (key === "id") return String(obj.id) === String(query.id).trim();
      return String(obj[key] ?? "").toLowerCase().includes(String(query[key]).toLowerCase());
    })
  );
}

function copyEntry(entry, db, key) {
  let password;
  try {
    password = decrypt(entry.password, key);
  } catch (err) {
    console.error(colors.red("Couldn't decrypt password of entry #" + entry.id + " (empty or damaged)"));
    return process.exit(1);
  }

  if (isAndroid()) {
    console.log(colors.green(password));
    return process.exit(0);
  }

  copyToClipboard(password, (err, seconds) => {
    if (err) {
      console.error(colors.red("Couldn't copy to clipboard (is xclip installed on linux?)"), err.message);
      return process.exit(1);
    }
    console.log(colors.cyan("Copied password of entry #" + entry.id + " to clipboard" + (seconds ? ", clears in " + seconds + "s" : "")));
    process.exit(0);
  });
}

function getEntry(db, query, opts, key) {
  if (!Object.keys(query).length) return showTable(db.accounts); // show all table

  const filteredEntries = filter(db.accounts, query);
  showTable(filteredEntries); // show matched items

  const action = opts.update ? updateEntry : opts.delete ? deleteEntry : opts.copy ? copyEntry : null;
  if (!action || !filteredEntries.length) return;
  if (filteredEntries.length > 1) return console.log(colors.yellow("Multiple entries matched, narrow it down (e.g. --id <id>)"));
  action(filteredEntries[0], db, key);
}

module.exports = getEntry;
