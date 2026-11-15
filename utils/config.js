const { askPassword, loadData, saveOrReport, run, credPath, log, lockVault, hasMaster, unlock } = require("./index");
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
    if (db.accounts.length || db.recovery) return log.error("credentials.json is missing, but db.json has data. Run 'recover' with your recovery phrase, or restore credentials.json.bak");
    return createMaster(cred, crypto.randomBytes(32)); // first time: new vault key
  }

  // changing it requires the current one; the vault key stays the same, so db.json is untouched
  const key = unlock((await askPassword("Current MASTER PASSWORD: ")).trim(), cred);
  if (!key) return log.error("Wrong password!");
  await createMaster(cred, key, "New MASTER PASSWORD: ");
}

// ask for a master password and lock `vaultKey` with it -> vaultKey, or null if nothing was saved
async function createMaster(cred, vaultKey, message = "Choose a MASTER PASSWORD: ") {
  const password = (await askPassword(message)).trim();
  if (!password) return fail("MASTER PASSWORD can't be empty");
  const retyped = (await askPassword("Re-type: ")).trim();
  if (password != retyped) return fail("MASTER PASSWORD not matched");
  const [okMsg, kind] = hasMaster(cred) ? ["Changed MASTER PASSWORD", "updated"] : ["Added MASTER PASSWORD", "added"];
  const next = lockVault(password, vaultKey);
  if (!saveOrReport(credPath, next, okMsg, "Error while saving credentials!", kind)) return null;
  Object.assign(cred, next);
  return vaultKey;

  function fail(msg) {
    log.error(msg);
    return null;
  }
}
