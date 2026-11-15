// minimal commander replacement
// supports: --opt <value>, --opt=value, boolean --flag, commands, options before or after the command,
// -h/--help, help [command], -V/--version, "--" (end of options), help wrapped to the terminal width.
// errors go to stderr with exit code 1. Uses process.exitCode (not process.exit) so piped output is never cut off.
const colors = require("./colors");

// spec: { version, description, options: [["--id <id>", "desc"], ["--cp", "desc"]], commands: { add: "desc" } }
// returns { command, opts, args }, or null when it already handled help/version/an error
function parseArgs(argv, spec) {
  const name = "keebox";
  const builtins = [
    ["-V, --version", "output the version number"],
    ["-h, --help", "display help for command"],
  ];
  const defs = spec.options.concat(builtins).map(([flags, desc]) => {
    const m = /^(?:-(\w), )?--([\w-]+)(?: <[\w-]+>)?$/.exec(flags);
    if (!m) throw new Error("bad option spec: " + flags);
    return { flags, desc, short: m[1], long: m[2], key: m[2].replace(/-(\w)/g, (_, c) => c.toUpperCase()), takesValue: flags.endsWith(">") };
  });

  // "✗ error: unknown option '--nme'" in red, then the "(Did you mean --name?)" hint in gray
  const fail = (msg) => {
    const [first, ...rest] = msg.split("\n");
    process.stderr.write(colors.red("✗ error: " + first) + "\n" + rest.map((l) => colors.gray(l.trim()) + "\n").join(""));
    process.exitCode = 1;
    return null;
  };

  const opts = {};
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      args.push(...argv.slice(i + 1));
      break;
    }
    if (arg.length < 2 || arg[0] !== "-") {
      args.push(arg);
      continue;
    }
    const eq = arg.startsWith("--") ? arg.indexOf("=") : -1;
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const def = defs.find((d) => flag === "--" + d.long || (d.short && flag === "-" + d.short));
    if (!def) return fail(`unknown option '${arg}'` + suggest(flag, defs.map((d) => "--" + d.long)));
    if (!def.takesValue) {
      if (eq !== -1) return fail(`option '${flag}' does not take a value`);
      opts[def.key] = true;
      continue;
    }
    const value = eq !== -1 ? arg.slice(eq + 1) : argv[++i];
    if (value === undefined) return fail(`option '${def.flags}' argument missing`);
    opts[def.key] = value; // repeated option: last one wins
  }

  const isCommand = (c) => Object.prototype.hasOwnProperty.call(spec.commands, c); // not "constructor", "toString", ...
  const command = args[0];
  if (opts.version) return void process.stdout.write(spec.version + "\n");
  if (opts.help) return void process.stdout.write(help(isCommand(command) ? command : null));
  if (command === "help") {
    if (args[1] && !isCommand(args[1])) return fail(`unknown command '${args[1]}'`);
    return void process.stdout.write(help(args[1]));
  }
  if (!command) {
    process.stderr.write(help());
    process.exitCode = 1;
    return null;
  }
  if (!isCommand(command)) return fail(`unknown command '${command}'` + suggest(command, Object.keys(spec.commands)) + "\nTry running --help");
  delete opts.help;
  delete opts.version;
  return { command, opts, args: args.slice(1) };

  // website look: amber section titles and "$ keebox ..." usage line, off-white terms, gray descriptions
  function help(cmd) {
    const heading = (t) => colors.bold.amber(t);
    const usage = (args) => colors.amber("$ ") + colors.text(name + " " + args);
    if (cmd) return `${heading("Usage")}\n  ${usage(cmd + " [options]")}\n\n${colors.gray(spec.commands[cmd])}\n\n${heading("Options")}\n${table([builtins[1]])}\n`;
    const commands = Object.entries(spec.commands).concat([["help [command]", "display help for command"]]);
    const options = spec.options.concat(builtins);
    return `${heading("Usage")}\n  ${usage("[options] [command]")}\n\n${colors.gray(spec.description)}\n\n${heading("Options")}\n${table(options, commands)}\n\n${heading("Commands")}\n${table(commands, options)}\n`;
  }
}

// two-column list, descriptions wrapped to the terminal width (columns line up across both lists)
function table(rows, otherRows = []) {
  const pad = Math.max(...rows.concat(otherRows).map(([term]) => term.length));
  const width = Math.max((process.stdout.columns || 80) - pad - 4, 40);
  // "<value>" / "[command]" placeholders dim, the rest of the term off-white
  const styleTerm = (term) => term.replace(/([<\[][^>\]]+[>\]])|([^<\[]+)/g, (_, arg, text) => (arg ? colors.dim(arg) : colors.text(text)));
  return rows.map(([term, desc]) => "  " + styleTerm(term) + " ".repeat(pad - term.length) + "  " + wrap(desc, width).map((l) => colors.gray(l)).join("\n" + " ".repeat(pad + 4))).join("\n");
}

function wrap(text, width) {
  const lines = [""];
  for (const word of text.split(/\s+/)) {
    const last = lines[lines.length - 1];
    if (last && last.length + 1 + word.length > width) lines.push(word);
    else lines[lines.length - 1] = last ? last + " " + word : word;
  }
  return lines;
}

// "(Did you mean --name?)" / "(Did you mean one of ...?)": closest matches within 2 edits (a swap counts as 1)
function suggest(input, candidates) {
  const strip = (s) => s.replace(/^--/, "");
  const dist = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    return d[a.length][b.length];
  };
  let best = 3;
  let similar = [];
  for (const c of candidates) {
    const [a, b] = [strip(input), strip(c)];
    const distance = dist(a, b);
    const length = Math.max(a.length, b.length);
    if (b.length <= 1 || (length - distance) / length <= 0.4 || distance > best) continue;
    if (distance < best) (best = distance), (similar = []);
    similar.push(c);
  }
  similar.sort();
  return similar.length > 1 ? `\n(Did you mean one of ${similar.join(", ")}?)` : similar.length ? `\n(Did you mean ${similar[0]}?)` : "";
}

module.exports = parseArgs;
