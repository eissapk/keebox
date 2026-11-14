> CLI Tool to for managing passwords (requires node14)

# Linux
##### Get started
```
cd /path/to/project # navigate to project folder
npm i # install modules
cp node_modules -r /path/to/project/node/linux # copy modules
cp ~/.nvm/versions/node/v14.0.0/bin/node /path/to/project/node/linux # copy node binary file
```

##### Final Structure
```
├── add.js
├── app.bat
├── app.sh
├── config.js
├── credentials.json
├── db.json
├── delete.js
├── get.js
├── index.js
├── node
│   ├── linux
│   │   ├── node
│   │   └── node_modules
│   ├── mac
│   │   ├── node
│   │   └── node_modules
│   └── win
│       ├── node.exe
│       └── node_modules
├── olum.js
├── package.json
├── readme.md
└── update.js
```

##### Make project portable
> copy the final structure to a USB flash and add alias in your .bashrc

##### copy project to usb flash
```
cp /path/to/project -r /path/to/usb-flash
```

##### add alias on OS

```
alias pass='node /path/to/usb-flash/index.js'
```

##### run it using alias anywhere on your OS

```
pass --help
pass --version
```

##### run it from usb-flash (portable)

```
/path/to/usb-flash/node/linux/node index.js -h
```

##### Useful commands using `pass` alias

```
pass get # lists all passwords in db.json file
pass get --id 2 # show acccount with id 2
pass get --name google # show acccount with name google
pass add --name google --username foo@gmail.com --location www.google.com # saves password for google
pass add --name github --username foo --location github.com --notes "2FA via phone" # with notes
pass make --length 20 # make random strong password of 20 chars
```

##### Create master password

The first `pass add` / `pass get` asks you to create one automatically. To add another master password later:

```
node config.js
```

##### Remove a master password

```
node config.js remove
```

##### Encryption

Each password is encrypted (AES-256-GCM) with one vault key. The vault key is stored in `credentials.json`, locked by each master password (scrypt + random salt), so `db.json` can't be read without a master password. Keep `db.json` and `credentials.json` together; if you forget every master password, the data can't be recovered.

Old setups are upgraded automatically on first unlock. The old files are kept as `db.json.v1.bak` / `credentials.json.v1.bak`. `db.json.v1.bak` can be read **without** a master password, so delete it once you've checked your entries.

##### Decryption flow

```
                         pass get --id 11 --copy
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ Any master password exists?   │  (credentials.json)
                    └───────────────┬───────────────┘
                         no │               │ yes
                            ▼               ▼
         ┌──────────────────────────┐   ┌──────────────────────────┐
         │ "No MASTER PASSWORD yet" │   │ Ask MASTER PASSWORD      │
         │ choose + re-type         │   │ (trim spaces)            │
         │ new random vault key     │   └────────────┬─────────────┘
         │ save slot, continue ───┐ │                │
         └────────────────────────┼─┘                ▼
                                  │      ╔═══════════════════════════════╗
                                  │      ║ PART 1: MASTER PASSWORD       ║
                                  │      ║ For each slot in credentials: ║
                                  │      ╚═══════════════╤═══════════════╝
                                  │                      ▼
                                  │      ┌──────────────────────────────┐
                                  │      │ scrypt(password, salt, n)    │
                                  │      │       → temporary key        │
                                  │      └──────────────┬───────────────┘
                                  │                     ▼
                                  │      ┌──────────────────────────────┐
                                  │      │ AES-GCM decrypt slot "key"   │
                                  │      │ (v2.iv.tag.data)             │
                                  │      └───────┬──────────────┬───────┘
                                  │      tag OK  │              │ tag fails
                                  │              │              ▼
                                  │              │   ┌──────────────────────┐
                                  │              │   │ more slots? try next │
                                  │              │   │ none left: old bcrypt│
                                  │              │   │ match? upgrade it    │
                                  │              │   │ else "Wrong password"│──► stop
                                  │              │   └──────────────────────┘
                                  │              ▼
                                  │      ┌──────────────────────────────┐
                                  └─────►│   VAULT KEY (in memory only) │
                                         └──────────────┬───────────────┘
                                                        ▼
                                         ┌──────────────────────────────┐
                                         │ Old-format entries in db?    │
                                         │ yes: back up to .v1.bak,     │
                                         │ re-encrypt with vault key    │
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
                                         │ split "v2.iv.tag.data"       │
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

| Step | File | Uses |
|---|---|---|
| Ask for or create the master password | `index.js` → `askMaster`, `config.js` → `createMaster` | master password |
| Master password → vault key | `vault.js` → `unlock` / `findSlot` / `openSlot` | `salt`, `n`, slot `key` |
| Vault key → account password | `olum.js` → `decrypt` (called from `get.js` → `copyEntry`) | `iv`, `tag`, `data` |

> `db.json` / `credentials.json` are created automatically if missing, and every save keeps the previous version as `db.json.bak` / `credentials.json.bak`.
