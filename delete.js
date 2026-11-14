const { modulesPath, prompt, saveJson } = require("./olum");
const colors = require(modulesPath + "/colors");
const path = require("path");

function deleteEntry(entry, db) {
  const dbPath = path.resolve(__dirname, "./db.json");
  const label = "#" + entry.id + " " + entry.name + " (" + entry.username + ")";

  prompt([{ type: "confirm", name: "question", message: "Entry " + label + " will be " + colors.yellow("deleted") + ", Are you sure" }], function (data) {
    if (!data.question) return;

    db.accounts = db.accounts.filter((obj) => obj.id != entry.id);
    try {
      saveJson(dbPath, db);
      console.log(colors.yellow("[-] Deleted entry " + label));
    } catch (err) {
      console.log(colors.red("Error while deleting entry!"), err);
    }
  });
}

module.exports = deleteEntry;
