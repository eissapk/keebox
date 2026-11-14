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

> `db.json` / `credentials.json` are created automatically if missing, and every save keeps the previous version as `db.json.bak` / `credentials.json.bak`.
