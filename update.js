const { modulesPath, prompt, encrypt, saveJson } = require("./olum");
const path = require("path");
const colors = require(modulesPath + "/colors");

function updateEntry(entry, db, key) {
  const dbPath = path.resolve(__dirname, "./db.json");
  const label = "#" + entry.id + " " + entry.name + " (" + entry.username + ")";

  prompt([{ type: "confirm", name: "question", message: "Entry " + label + " will be " + colors.yellow("updated") + ", Are you sure" }], function (data) {
    if (!data.question) return;

    console.log(colors.gray("Enter = keep current value, '-' = clear it"));
    const fields = ["name", "location", "username", "login"];
    const questions = fields.map((f) => ({ type: "input", name: f, message: "New " + f + " [" + (entry[f] || "") + "]: " }));
    questions.push({ type: "password", name: "password", message: "New password (Enter = keep): " });

    prompt(questions, function (answers) {
      fields.forEach((f) => {
        const value = answers[f].trim();
        if (value === "-" && f !== "name") entry[f] = "";
        else if (value !== "" && value !== "-") entry[f] = value;
      });
      if (answers.password !== "") entry.password = encrypt(answers.password, key);

      try {
        saveJson(dbPath, db); // entry is a reference into db.accounts
        console.log(colors.yellow("[+] Updated entry " + "#" + entry.id));
      } catch (err) {
        console.log(colors.red("Error while updating entry!"), err);
      }
    });
  });
}

module.exports = updateEntry;
