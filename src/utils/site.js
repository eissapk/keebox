import * as icons from "./icons.js";

export const REPO = "https://github.com/eissapk/keebox";
export const CLONE = "git clone https://github.com/eissapk/keebox.git";
export const NPM = "https://www.npmjs.com/package/keebox";
export const NPM_INSTALL = "npm install -g keebox";

export const platforms = [
  { name: "macOS", icon: icons.apple },
  { name: "Linux", icon: icons.linux },
  { name: "Windows", icon: icons.windows },
  { name: "Android · Termux", icon: icons.android },
];

export const nav = [
  { label: "Features", href: "#features" },
  { label: "Commands", href: "#commands" },
  { label: "Security", href: "#security" },
  { label: "Portability", href: "#portability" },
  { label: "Trade-offs", href: "#tradeoffs" },
  { label: "Roadmap", href: "#roadmap" },
];

// What the CLI does today (main branch).
export const features = [
  {
    icon: icons.zap,
    title: "Password generator",
    text: "Cryptographically random passwords from 4 to 1024 characters, with at least one lowercase, uppercase, digit and symbol. Straight to your clipboard.",
    cmd: "make --size 24",
  },
  {
    icon: icons.circlePlus,
    title: "Account management",
    text: "Name, URL, username, plus a login and notes that are encrypted like the password. The password is typed at a hidden prompt, never into shell history.",
    cmd: "add --name github …",
  },
  {
    icon: icons.search,
    title: "Quick retrieval",
    text: "Filter by id, name, URL or username with a case-insensitive match. Results come back as a table that fits your terminal.",
    cmd: "get --name goo",
  },
  {
    icon: icons.refreshCw,
    title: "Easy updates",
    text: "Edit an entry field by field: Enter keeps the current value, a dash clears it. Every entry keeps its created and updated dates.",
    cmd: "get --id 2 --edit",
  },
  {
    icon: icons.trash2,
    title: "Safe deletion",
    text: "Remove what you no longer need. Every delete asks first, and every save keeps a .bak copy.",
    cmd: "get --id 2 --rm",
  },
  {
    icon: icons.clipboardCheck,
    title: "Self-clearing clipboard",
    text: "Copy a password with one flag. It's wiped after 20 seconds, if it's still the one on the clipboard.",
    cmd: "get --id 12 --cp",
  },
  {
    icon: icons.lifeBuoy,
    title: "Recovery phrase",
    text: "A 12-word phrase, like a crypto wallet's. Lost credentials.json or forgot the master password? It gets you back in.",
    cmd: "recovery",
  },
  {
    icon: icons.fileSpreadsheet,
    title: "CSV export & import",
    text: "Take everything with you whenever you want, or bring accounts in from a CSV. Duplicates are skipped.",
    cmd: "export",
  },
  {
    icon: icons.circleCheck,
    title: "Damage check",
    text: "A read-only scan that lists broken or undecryptable entries, and points to a healthy copy in the backup.",
    cmd: "check",
  },
];

// Shipped since the first roadmap, and what's still planned.
export const roadmap = [
  {
    title: "Faster to use",
    icon: icons.wandSparkles,
    items: [
      { icon: icons.packageIcon, text: "Install with npm as a global command", done: true },
      { icon: icons.terminal, text: "Short flags: --cp, --rm, --edit, --show", done: true },
      { icon: icons.packageIcon, text: "Standalone binaries for Linux, macOS and Windows" },
      { icon: icons.searchCode, text: "Fuzzy search across your accounts" },
      { icon: icons.zap, text: "Generate a password while adding an account" },
      { icon: icons.circlePlus, text: "Prompts for any missing field" },
    ],
  },
  {
    title: "Safer vault",
    icon: icons.shieldCheck,
    items: [
      { icon: icons.keyRound, text: "Change your master password", done: true },
      { icon: icons.lifeBuoy, text: "12-word recovery phrase for a lost credentials file", done: true },
      { icon: icons.clock, text: "Created and updated dates on every entry", done: true },
      { icon: icons.circleCheck, text: "Damage check for the whole vault", done: true },
      { icon: icons.fileLock, text: "Encrypt the whole database, names included" },
    ],
  },
  {
    title: "Your data, anywhere",
    icon: icons.hardDrive,
    items: [
      { icon: icons.fileDown, text: "Export your vault to CSV", done: true },
      { icon: icons.fileSpreadsheet, text: "Import accounts from CSV", done: true },
      { icon: icons.hardDrive, text: "Choose where the vault lives (KEEBOX_HOME)", done: true },
      { icon: icons.archive, text: "Backup command" },
    ],
  },
];

// Honest limits, from the README.
export const tradeoffs = [
  {
    icon: icons.smartphone,
    title: "No autofill, no sync",
    text: "KeeBox doesn't fill in browser forms or sync between devices. You copy the files where you need them, and you're in charge of backups.",
  },
  {
    icon: icons.eye,
    title: "Names are not secret",
    text: "Passwords, logins and notes are encrypted. Account names, URLs and usernames are kept as plain text so you can search them.",
  },
  {
    icon: icons.fileSpreadsheet,
    title: "Exports are plain text",
    text: "An exported CSV holds every password decrypted. It's written readable by you only, but delete it when you're done.",
  },
  {
    icon: icons.keyRound,
    title: "Only as strong as your password",
    text: "Anyone who copies db.json and credentials.json can try to guess the master password offline. scrypt slows them down; a strong password stops them.",
  },
  {
    icon: icons.terminal,
    title: "Needs Node.js 18+",
    text: "Install it with npm, or carry a Node binary next to a portable copy. Standalone binaries are still on the roadmap.",
  },
  {
    icon: icons.clipboardCheck,
    title: "Clipboard tools on Linux",
    text: "macOS, Windows and WSL work as is. Linux needs xclip (X11) or wl-clipboard (Wayland). On Termux, passwords are printed instead.",
  },
];
