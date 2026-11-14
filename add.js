const { modulesPath, prompt, encrypt, saveJson } = require("./olum");
const path = require("path");
const colors = require(modulesPath + "/colors");

function mkEntryId(arr) {
  if (!arr.length) return 1;
  let ids = [];
  arr.forEach((obj) => ids.push(obj.id)); // push all ids
  ids.sort((a, b) => a - b); // ascending order
  const currentMaxId = ids.pop();
  const nextId = currentMaxId + 1; // get max number + 1
  //   console.log({ currentMaxId });
  //   console.log({ nextId });
  return nextId;
}

function addEntry(db, entry, key) {
  const dbPath = path.resolve(__dirname, "./db.json");

  const entryExists = db.accounts.find((obj) => {
    if (entry["name"] == obj["name"] && entry["location"] == obj["location"] && entry["username"] == obj["username"] && entry["login"] == obj["login"]) return obj;
  });
  if (entryExists) return console.log(colors.yellow("Entry exists!"));

  prompt([{ type: "password", name: "password", message: "Add password: " }], function (data) {
    entry.password = encrypt(data.password, key);
    entry.id = mkEntryId(db.accounts);
    // console.log(entry);
    db.accounts.push(entry); // push new entry

    try {
      saveJson(dbPath, db);
      console.log(colors.green("[+] Added entry #" + entry.id));
    } catch (err) {
      console.log(colors.red("Error while adding entry!"), err);
    }
  });
}

module.exports = addEntry;
