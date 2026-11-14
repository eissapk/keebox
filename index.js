const { modulesPath, mkPass, prompt, isAndroid, loadJson, copyToClipboard } = require("./olum");
const { dbPath, credPath, hasMaster, unlock } = require("./vault");
const { createMaster } = require("./config");
const crypto = require("crypto");
const colors = require(modulesPath + "/colors");
const commander = require(modulesPath + "/commander");
const pkgJSON = require("./package.json");
const getEntry = require("./get");
const addEntry = require("./add");

// connect to db
let db = null;
let cred = null;
try {
  db = loadJson(dbPath, { accounts: [] });
  cred = loadJson(credPath, { slots: [] });
} catch (err) {
  return console.error(colors.red("Couldn't connect to db! (backups: db.json.bak, credentials.json.bak)"), "\n", err);
}

const cmd = new commander.Command();

cmd.option("--id <id>", "Include account id - use it with 'get/add' commands");
cmd.option("--name <name>", "Include account name - use it with 'get/add' commands");
cmd.option("--location <location>", "Include account url - use it with 'get/add' commands");
cmd.option("--username <username>", "Include account username - use it with 'get/add' commands");
cmd.option("--login <login>", "Include account login - use it with 'get/add' commands");

cmd.option("--copy", "Copy account password to clipboard - use it with 'get' command");
cmd.option("--update", "Update account in db - use it with 'get' command");
cmd.option("--delete", "Delete account in db - use it with 'get' command");

cmd.option("--length <length>", "Password length - use it with 'make' command");

cmd.command("add").description("Add account").action(add);
cmd.command("get").description("display account(s)").action(get);
cmd.command("make").description("Generate a password").action(make);

cmd.version(pkgJSON.version).description("Password Manager CLI Tool (" + pkgJSON.version + ")");
cmd.on("command:*", (operands) => {
  console.error(colors.red(`error: unknown command '${operands[0]}'\n Try running --help`));
  process.exitCode = 1;
});

cmd.parse(process.argv);

// ask master password -> vault key
function askMaster(cb) {
  if (!hasMaster(cred)) {
    console.log(colors.yellow("No MASTER PASSWORD yet, let's create one."));
    return createMaster(cred, crypto.randomBytes(32), cb);
  }
  prompt([{ type: "password", name: "password", message: "MASTER PASSWORD:" }], function (data) {
    var key = unlock(data.password.trim(), cred, db);
    if (!key) return console.error(colors.red("Wrong password!"));
    cb(key);
  });
}

function add() {
  var obj = cmd.opts();
  if (!obj.name) return console.error(colors.red("Missing --name argument!"));
  if (!obj.location) return console.error(colors.red("Missing --location argument!"));
  if (!obj.username) return console.error(colors.red("Missing --username argument!"));
  if (!obj.login) obj.login = "";

  askMaster((key) => addEntry(db, obj, key));
}

function get() {
    var query = {};
    var opts = cmd.opts();
    if (opts.id) query.id = opts.id;
    if (opts.name) query.name = opts.name;
    if (opts.location) query.location = opts.location;
    if (opts.username) query.username = opts.username;
    if (opts.login) query.login = opts.login;

  askMaster((key) => getEntry(db, query, opts, key));
}

function make() {
  var obj = cmd.opts();
  if (!obj.length) return console.error(colors.red("Missing --length argument!"));
  var length = Number(obj.length);
  if (!Number.isInteger(length) || length < 4 || length > 1024) return console.error(colors.red("--length must be a number between 4 and 1024"));
  var pass = mkPass(length);

  if (isAndroid()) {
    console.log(colors.green(pass));
    return process.exit(0);
  }

  copyToClipboard(pass, (err, seconds) => {
    if (err) {
      console.log(colors.yellow("Couldn't copy to clipboard:"), pass);
      return process.exit(0);
    }
    console.log(colors.green("Copied to clipboard" + (seconds ? " (clears in " + seconds + "s)" : "") + ":"), pass);
    process.exit(0);
  });

}
