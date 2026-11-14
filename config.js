const { prompt, modulesPath, loadJson, saveJson } = require("./olum");
const { dbPath, credPath, makeSlot, findSlot, hasMaster, unlock } = require("./vault");
const crypto = require("crypto");
const colors = require(modulesPath + "/colors");

// usage: node config.js          -> add master password
//        node config.js remove   -> remove a master password
if (require.main === module) main();
module.exports = { createMaster };

function main() {
  let cred = null;
  let db = null;
  try {
    cred = loadJson(credPath, { slots: [] });
    db = loadJson(dbPath, { accounts: [] }); // make sure db.json exists too
  } catch (err) {
    return console.error(colors.red("Couldn't connect to db! (backups: credentials.json.bak, db.json.bak)"), "\n", err);
  }
  if (process.argv[2] === "remove") remove(cred, db);
  else add(cred, db);
}

function add(cred, db) {
  if (!hasMaster(cred)) return createMaster(cred, crypto.randomBytes(32)); // first time: new vault key

  // adding another master password requires an existing one
  prompt([{ type: "password", name: "password", message: "Current MASTER PASSWORD: " }], function (data) {
    const key = unlock(data.password.trim(), cred, db);
    if (!key) return console.log(colors.red("Wrong password!"));
    createMaster(cred, key);
  });
}

// ask for a new master password, save its slot for `vaultKey`, then cb(vaultKey)
function createMaster(cred, vaultKey, cb) {
  prompt([{ type: "password", name: "password", message: "Choose a MASTER PASSWORD: " }], function (data) {
    const password = data.password.trim();
    if (!password) return console.log(colors.red("MASTER PASSWORD can't be empty"));
    prompt([{ type: "password", name: "password", message: "Re-type: " }], function (data2) {
      if (password != data2.password.trim()) return console.log(colors.red("MASTER PASSWORD not matched"));
      if (findSlot(password, cred).key) return console.log(colors.yellow("Password exists!"));
      cred.slots = cred.slots || [];
      cred.slots.push(makeSlot(password, vaultKey));
      try {
        saveJson(credPath, cred);
        console.log(colors.green("[+] Added password."));
      } catch (err) {
        return console.log(colors.red("Error while saving credentials!"), err);
      }
      if (cb) cb(vaultKey);
    });
  });
}

function remove(cred, db) {
  prompt([{ type: "password", name: "password", message: "MASTER PASSWORD to remove: " }], function (data) {
    const password = data.password.trim();
    if (!unlock(password, cred, db)) return console.log(colors.red("Password not found!")); // also upgrades old setups
    const { index } = findSlot(password, cred);
    if (cred.slots.length === 1) return console.log(colors.yellow("Can't remove the only MASTER PASSWORD"));
    cred.slots.splice(index, 1);
    try {
      saveJson(credPath, cred);
      console.log(colors.green("[-] Removed password."));
    } catch (err) {
      console.log(colors.red("Error while saving credentials!"), err);
    }
  });
}
