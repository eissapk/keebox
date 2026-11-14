import * as icons from "./icons.js";

export const REPO = "https://github.com/eissapk/password-manager";
export const CLONE = "git clone https://github.com/eissapk/password-manager.git";

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
  { label: "Roadmap", href: "#roadmap" },
];

// What the CLI does today (upgrade branch).
export const features = [
  {
    icon: icons.zap,
    title: "Password generator",
    text: "Strong random passwords from 4 to 1024 characters, sent straight to your clipboard.",
    cmd: "make --length 24",
  },
  {
    icon: icons.circlePlus,
    title: "Account management",
    text: "Name, location, username, login and notes. The password is typed at a hidden prompt, never into shell history.",
    cmd: "add --name github …",
  },
  {
    icon: icons.search,
    title: "Quick retrieval",
    text: "Filter by any field with a case-insensitive match. Results come back as a clean table.",
    cmd: "get --name goo",
  },
  {
    icon: icons.refreshCw,
    title: "Easy updates",
    text: "Edit an entry field by field: Enter keeps the current value, a dash clears it.",
    cmd: "get --id 2 --update",
  },
  {
    icon: icons.trash2,
    title: "Safe deletion",
    text: "Remove what you no longer need. Every delete asks first, and every save keeps a .bak copy.",
    cmd: "get --id 2 --delete",
  },
  {
    icon: icons.clipboardCheck,
    title: "Self-clearing clipboard",
    text: "Copy a password with one flag. It's wiped after 20 seconds, if it's still the one on the clipboard.",
    cmd: "get --name github --copy",
  },
];

// Planned work, from the upgrade branch README todos.
export const roadmap = [
  {
    title: "Faster to use",
    icon: icons.wandSparkles,
    items: [
      { icon: icons.packageIcon, text: "Standalone binaries for Linux, macOS and Windows" },
      { icon: icons.searchCode, text: "Fuzzy search across your accounts" },
      { icon: icons.terminal, text: "Short commands: cp, rm, edit, show" },
      { icon: icons.zap, text: "Generate a password while adding an account" },
      { icon: icons.circlePlus, text: "Prompts for any missing field" },
    ],
  },
  {
    title: "Safer vault",
    icon: icons.shieldCheck,
    items: [
      { icon: icons.fileLock, text: "Encrypt the whole database, names included" },
      { icon: icons.keyRound, text: "Change your master password" },
      { icon: icons.lifeBuoy, text: "Emergency key to recover a lost credentials file" },
      { icon: icons.clock, text: "Created and updated dates on every entry" },
    ],
  },
  {
    title: "Your data, anywhere",
    icon: icons.hardDrive,
    items: [
      { icon: icons.archive, text: "Backup command" },
      { icon: icons.fileDown, text: "Export your vault" },
      { icon: icons.fileSpreadsheet, text: "Import accounts from CSV" },
      { icon: icons.hardDrive, text: "Choose where the database lives" },
      { icon: icons.packageIcon, text: "Runs on Node 22 LTS" },
    ],
  },
];
