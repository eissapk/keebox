// entry fields (besides id/password/created/updated), also the table columns after id
const FIELDS = ["name", "url", "username", "login", "notes"];
// fields encrypted like the password: "***" in the table, read with --show
const SECRET_FIELDS = ["login", "notes"];

module.exports = { FIELDS, SECRET_FIELDS };
