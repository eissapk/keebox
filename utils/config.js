const { askPassword, loadData, saveOrReport, run, credPath, colors, lockVault, hasMaster, unlock } = require("./index");
const crypto = require("crypto");

// usage: node utils/config.js   -> create the master password, or change it
if (require.main === module) run(main);
module.exports = { createMaster };

async function main() {
  const data = loadData();
  if (!data) return;
  const { db, cred } = data;
  if (!hasMaster(cred)) {
    // a new vault key would make the existing accounts unreadable
    if (db.accounts.length || db.recovery) return console.log(colors.red("credentials.json is missing, but db.json has data. Run 'recover' with your recovery phrase, or restore credentials.json.bak"));
    return createMaster(cred, crypto.randomBytes(32)); // first time: new vault key
  }

  // changing it requires the current one; the vault key stays the same, so db.json is untouched
  const key = unlock((await askPassword("Current MASTER PASSWORD: ")).trim(), cred);
  if (!key) return console.log(colors.red("Wrong password!"));
  await createMaster(cred, key, "New MASTER PASSWORD: ");
}

// ask for a master password and lock `vaultKey` with it -> vaultKey, or null if nothing was saved
async function createMaster(cred, vaultKey, message = "Choose a MASTER PASSWORD: ") {
  const password = (await askPassword(message)).trim();
  if (!password) return fail(colors.red("MASTER PASSWORD can't be empty"));
  const retyped = (await askPassword("Re-type: ")).trim();
  if (password != retyped) return fail(colors.red("MASTER PASSWORD not matched"));
  const okMsg = hasMaster(cred) ? "[+] Changed password." : "[+] Added password.";
  const next = lockVault(password, vaultKey);
  if (!saveOrReport(credPath, next, colors.green(okMsg), "Error while saving credentials!")) return null;
  Object.assign(cred, next);
  return vaultKey;

  function fail(msg) {
    console.log(msg);
    return null;
  }
}
