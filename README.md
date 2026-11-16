<p align="center">
  <img src="assets/logo.svg" alt="KeeBox logo" width="120">
</p>

<h1 align="center">KeeBox</h1>

<p align="center">
  <b>KeeBox</b> is an offline password manager that lives in your terminal.<br>
  Your passwords. Your keys. Your files.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/keebox"><img src="https://img.shields.io/npm/v/keebox?color=f5a524&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/keebox"><img src="https://img.shields.io/npm/dm/keebox?color=f5a524" alt="npm downloads"></a>
  <a href="https://opensource.org/license/mit"><img src="https://img.shields.io/badge/license-MIT-f5a524" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-f5a524?logo=nodedotjs&logoColor=white" alt="node >= 18">
  <img src="https://img.shields.io/badge/dependencies-0-7ccf8a" alt="zero dependencies">
</p>

<p align="center">
  <a href="https://keebox.eissa.top">Website</a> ·
  <a href="#get-started">Get started</a> ·
  <a href="#commands">Commands</a> ·
  <a href="#encryption">Security</a>
</p>

---

Most password managers ask you to trust them with everything: your passwords sit on their servers, behind their account system, their app updates and their subscription. When one of them is breached, changes its pricing or shuts down, your vault goes with it.

**KeeBox** takes the opposite approach. It's a password manager with no server and no account. Your vault is two small JSON files that you own: keep them on your laptop, or carry them on a USB stick and run KeeBox on any machine you plug into.

##### Why switch to **KeeBox**

- **Nothing in the cloud.** KeeBox never touches the network: no sync server to breach, no telemetry, no account to phish. Your encrypted vault only exists where you put it.
- **Strong, standard encryption.** Every password, login and note is encrypted with AES-256-GCM. The key is locked behind your master password with scrypt, which makes guessing slow and expensive. Tampered or damaged entries are detected and refused, never silently decrypted into garbage.
- **A recovery phrase, like a crypto wallet.** Lost your credentials file or forgot your master password? A 12-word recovery phrase gets you back in. Without the phrase or the password, nobody can open the vault, not even the author of KeeBox.
- **Zero dependencies.** No third-party packages, so there's no supply chain to compromise. The whole tool is about 1,300 lines of plain Node.js that you can read and audit in an afternoon.
- **Portable.** Copy the folder plus a Node.js binary to a USB drive and it runs on Linux, macOS, Windows and Android (Termux), no installation needed.
- **Fast from the terminal.** Generate strong passwords, find accounts by any field, and copy a password to the clipboard. It's wiped automatically after 20 seconds.
- **Yours to keep.** Export everything to CSV whenever you want, import accounts from CSV, and check your vault for damage. Open source and MIT licensed.

> **What you trade:** KeeBox doesn't autofill in your browser or sync between devices for you. You're in charge of your files and backups, and that's the point.

##### Get started

Requires Node.js 18+.

```
npm install -g keebox
keebox -h
```

Your vault (`db.json` + `credentials.json`) is kept in `~/.keebox/`, outside the npm folder, so updating or uninstalling KeeBox never touches it. To keep it somewhere else (an encrypted drive, a backed-up folder...), set `KEEBOX_HOME`:

```
export KEEBOX_HOME=/path/to/vault-folder # in your .bashrc / .zshrc
```

Or run it from source, without installing (the vault then lives in the project folder):

```
git clone https://github.com/eissapk/keebox.git
cd keebox # no npm install needed, there are no dependencies
node bin/index.js -h
```

Clipboard: macOS and Windows/WSL work as is, Linux needs `xclip` (X11) or `wl-clipboard` (Wayland). On Android (Termux) passwords are printed instead of copied.

##### Structure

```
├── assets
│   └── logo.svg
├── bin
│   └── index.js         # CLI entry (the `keebox` command): commands + master password prompt
├── credentials.json     # created on first run (master password lock), not in git
├── db.json              # created on first run (accounts + recovery lock), not in git
├── node                 # optional, for a portable copy (see below), not in git
│   ├── linux/node
│   ├── mac/node
│   └── win/node.exe
├── options              # one file per command
│   ├── add.js
│   ├── check.js
│   ├── delete.js
│   ├── export.js
│   ├── get.js
│   ├── import.js
│   ├── index.js
│   ├── recovery.js      # 'recovery' + 'recover'
│   └── update.js
├── package.json
├── README.md
├── test                 # npm test
└── utils
    ├── cli.js           # argument parser
    ├── colors.js        # KeeBox palette (truecolor / 256 / 16 colors)
    ├── config.js        # create / change the master password
    ├── csv.js
    ├── fields.js
    ├── index.js         # encrypt/decrypt, load/save db, clipboard, helpers
    ├── log.js           # message styles (✓ / [+] / [-] / [!] / ✗)
    ├── mnemonic.js      # 12-word recovery phrase (BIP39)
    ├── prompt.js
    ├── table.js
    ├── vault.js         # vault key locking (master password / recovery phrase)
    └── wordlist.js      # BIP39 English wordlist
```

`db.json` / `credentials.json` sit in the project folder when run from source or a portable copy, in `~/.keebox/` when installed with npm, or in `$KEEBOX_HOME` when it's set.

##### Make it portable (USB flash)

Copy the project with a Node.js binary per OS, so it runs on machines without Node installed. The vault is kept next to it, on the flash drive:

```
cp -r /path/to/project /path/to/usb-flash
cp "$(command -v node)" /path/to/usb-flash/node/linux/node # repeat for mac/node and win/node.exe
```

Run it from the flash drive:

```
/path/to/usb-flash/node/linux/node /path/to/usb-flash/bin/index.js -h
```

Or add an alias in your `.bashrc` / `.zshrc`, and use it anywhere:

```
alias keebox='node /path/to/usb-flash/bin/index.js'
keebox --help
keebox --version
```

##### Commands

```
keebox get # list all accounts
keebox get --id 2 # show account with id 2
keebox get --name google # show accounts whose name contains "google"
keebox get --id 2 --cp # copy its password to the clipboard (auto-cleared after 20s)
keebox get --id 2 --show # show its login/notes
keebox get --id 2 --edit # update it (Enter = keep a value, '-' = clear it)
keebox get --id 2 --rm # delete it
keebox add --name google --username foo@gmail.com --url www.google.com # add an account (asks for its password)
keebox add --name github --username foo --url github.com --login foo@mail.com --notes "2FA via phone" # with login/notes (encrypted)
keebox make --size 20 # generate a random strong password of 20 chars
keebox export # export all accounts, decrypted, to keebox-export-<date>.csv
keebox export --name google --out google.csv # export matching accounts to google.csv
keebox import --file accounts.csv # add accounts from a csv (same columns as export; id is ignored, duplicates skipped)
keebox check # damage check: lists accounts that are broken or can't be decrypted (read-only, exit code 1 if any)
keebox recovery # create (or replace) the 12-word recovery phrase
keebox recover # lost credentials.json / forgot the master password: unlock with the recovery phrase, set a new master password
keebox master # create or change the master password
```

Exported CSV files are **not encrypted**, delete them when you're done.

##### Create / change master password

On a new (empty) vault, the first `keebox add` / `keebox get` asks you to create one. To create it yourself, or change it later (asks the current one first; `db.json` stays as is, and the recovery phrase keeps working):

```
keebox master
```

##### Encryption

Each password, login and notes is encrypted (AES-256-GCM) with one random 256-bit **vault key** (login/notes show as `***` in the table, read them with `--show`). The vault key is never stored as is, only locked, in two independent places:

| Where | Locked with | Opened by |
|---|---|---|
| `credentials.json` → `{ salt, n, key }` | scrypt(master password, salt) + AES-256-GCM | the master password |
| `db.json` → `recovery: { salt, n, key }` | scrypt(12-word phrase, salt) + AES-256-GCM | the recovery phrase (`keebox recover`) |

What gets you into the accounts:

| You have | Access? |
|---|---|
| `db.json` + `credentials.json` + master password | yes (normal use) |
| `db.json` + recovery phrase | yes: `keebox recover` sets a new master password and writes a new `credentials.json` |
| `db.json` + master password, but no `credentials.json` | **no**: the master password only opens `credentials.json` (restore `credentials.json.bak` or a backup) |
| `db.json` alone | **no**, for anyone: it would mean guessing a 128-bit phrase or a 256-bit key |

So keep `db.json` and `credentials.json` together and backed up, choose a strong master password (a copied `credentials.json` + `db.json` is only as safe as it), and keep the recovery phrase offline.

##### Recovery phrase (emergency key)

`keebox recovery` makes a 12-word phrase (BIP39 English words, like a crypto wallet seed: 128 random bits + checksum) and locks the same vault key with it into `db.json`. The phrase itself is never saved, it's shown once: write it down, then type it back to confirm.

If `credentials.json` is deleted or you forget the master password, `keebox recover` asks for the 12 words (any case/spacing; typos and swapped words are caught by the checksum), unlocks the vault key and lets you set a new master password. Only `credentials.json` is written, `db.json` isn't changed, and the same phrase keeps working afterwards. Running `keebox recovery` again replaces the phrase (the old one stops working, except against an older `db.json.bak`).

Anyone with the phrase + `db.json` can read every account, so guard it like the master password.

##### Files

`db.json` (`recovery` is `null` until you run `keebox recovery`):

```json
{
  "recovery": { "salt": "...", "n": 32768, "key": "iv.tag.data" },
  "accounts": [
    {
      "id": 1,
      "name": "github",
      "url": "github.com",
      "username": "foo",
      "login": "iv.tag.data",
      "notes": "iv.tag.data",
      "password": "iv.tag.data",
      "created": "2026-01-01T00:00:00.000Z",
      "updated": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

`credentials.json` (`{}` until a master password is created):

```json
{ "salt": "...", "n": 32768, "key": "iv.tag.data" }
```

Both are created automatically if missing, and every save keeps the previous version as `db.json.bak` / `credentials.json.bak`. If `credentials.json` is missing but `db.json` has data, KeeBox won't create a new master password (that would make a new vault key and lock out the existing accounts); it asks you to run `keebox recover` or restore `credentials.json.bak` instead.

##### Decryption flow

```
                        keebox get --id 11 --cp
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ Master password exists?       │  (credentials.json)
                    └───────────────┬───────────────┘
                         no │               │ yes
                            ▼               ▼
         ┌──────────────────────────┐   ┌──────────────────────────┐
         │ db.json has data?        │   │ Ask MASTER PASSWORD      │
         │ yes: stop, "run 'recover'│   │ (trim spaces)            │
         │  or restore .bak"        │   └────────────┬─────────────┘
         │ no: choose + re-type,    │                │
         │ new random vault key,    │                │
         │ save it, continue ─────┐ │                ▼
         └────────────────────────┼─┘
                                  │      ╔═══════════════════════════════╗
                                  │      ║ PART 1: MASTER PASSWORD       ║
                                  │      ║ credentials.json {salt,n,key} ║
                                  │      ╚═══════════════╤═══════════════╝
                                  │                      ▼
                                  │      ┌──────────────────────────────┐
                                  │      │ scrypt(password, salt, n)    │
                                  │      │       → temporary key        │
                                  │      └──────────────┬───────────────┘
                                  │                     ▼
                                  │      ┌──────────────────────────────┐
                                  │      │ AES-GCM decrypt "key"        │
                                  │      │ (iv.tag.data)                │
                                  │      └───────┬──────────────┬───────┘
                                  │      tag OK  │              │ tag fails
                                  │              │              ▼
                                  │              │   ┌──────────────────────┐
                                  │              │   │ "Wrong password"     │──► stop
                                  │              │   └──────────────────────┘
                                  │              ▼
                                  │      ┌──────────────────────────────┐
                                  └─────►│   VAULT KEY (in memory only) │
                                         └──────────────┬───────────────┘
                                                        ▼
                                         ╔═══════════════════════════════╗
                                         ║ PART 2: ACCOUNT PASSWORD      ║
                                         ╚═══════════════╤═══════════════╝
                                                         ▼
                                         ┌──────────────────────────────┐
                                         │ Filter db.json accounts      │
                                         │ exactly 1 match? else stop   │
                                         └──────────────┬───────────────┘
                                                        ▼
                                         ┌──────────────────────────────┐
                                         │ split "iv.tag.data"          │
                                         │ AES-GCM decrypt with         │
                                         │ VAULT KEY + iv + tag         │
                                         └───────┬──────────────┬───────┘
                                         tag OK  │              │ fails
                                                 ▼              ▼
                                  ┌───────────────────────┐  ┌───────────────────┐
                                  │ plain password        │  │ "empty or damaged"│
                                  │ Termux: print it      │  └───────────────────┘
                                  │ else: clipboard,      │
                                  │ auto-clear in 20s     │
                                  └───────────────────────┘
```

##### Recovery flow

```
                              keebox recover
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ db.json has a recovery lock?  │──► no: stop
                    └───────────────┬───────────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │ Ask RECOVERY PHRASE (12 words)│
                    │ 12 known words + checksum OK? │──► no: "Invalid recovery phrase"
                    └───────────────┬───────────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │ scrypt(phrase, salt, n)       │
                    │ AES-GCM decrypt recovery.key  │──► tag fails: "Wrong recovery phrase"
                    └───────────────┬───────────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │ VAULT KEY (in memory only)    │
                    │ choose new MASTER PASSWORD    │
                    │ → writes credentials.json     │
                    │ (db.json unchanged)           │
                    └───────────────────────────────┘
```

| Step | File | Uses |
|---|---|---|
| Ask for or create the master password | `bin/index.js` → `askMaster`, `utils/config.js` → `createMaster` | master password |
| Master password → vault key | `utils/vault.js` → `unlock` | `credentials.json` `salt`, `n`, `key` |
| Create the recovery phrase (`keebox recovery`) | `options/recovery.js` → `createRecovery`, `utils/vault.js` → `makeRecovery`, `utils/mnemonic.js` | `db.json` `recovery` |
| Recovery phrase → vault key (`keebox recover`) | `options/recovery.js` → `recoverVault`, `utils/vault.js` → `recover` | `db.json` `recovery` |
| Vault key → account password | `utils/index.js` → `decrypt` (called from `options/get.js` → `copyEntry`) | `iv`, `tag`, `data` |

##### Tests

```
npm test
```

##### Build binaries

```
npm install -g @yao-pkg/pkg
npm run build
```