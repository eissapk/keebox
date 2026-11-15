// minimal inquirer replacement, public Node APIs only
// await prompt([{ type: "input" | "password" | "confirm", name, message, default }]) -> answers
// - interactive (stdin is a terminal): readline for input/confirm, raw-mode reader for passwords (masked with "•")
// - piped stdin: one shared line queue, so answers can be scripted: printf 'pw\ny\n' | node index.js get --id 1 --rm
// - Ctrl+C exits 130; Ctrl+D / end of input cancels with exit 1 (never auto-answers, e.g. "delete? (Y/n)")
const readline = require("readline");
const readlinePromises = require("readline/promises");

// prompts go to the terminal even when stdout is redirected (node index.js get > list.txt)
function promptOut() {
  return process.stdout.isTTY || !process.stderr.isTTY ? process.stdout : process.stderr;
}

function abortPrompt(code) {
  if (process.stdin.isTTY && process.stdin.isRaw) process.stdin.setRawMode(false);
  promptOut().write("\n");
  process.exit(code);
}

// interactive text line, with normal editing (arrows, Home/End, ...)
async function readTtyLine(label) {
  const rl = readlinePromises.createInterface({ input: process.stdin, output: promptOut(), historySize: 0 });
  let answered = false;
  rl.on("SIGINT", () => abortPrompt(130));
  rl.on("close", () => answered || abortPrompt(1)); // Ctrl+D
  const answer = await rl.question(label);
  answered = true;
  rl.close();
  return answer;
}

// interactive password: raw mode, each char shown as a dim "•" (never the text itself); Backspace and Ctrl+U work, pasting works
const MASK_ERASE = "\b \b";
function mask(n) {
  const { colors } = require("./index");
  return colors.dim("•".repeat(n));
}
function readTtyPassword(label) {
  return new Promise((resolve) => {
    const { stdin } = process;
    const out = promptOut();
    out.write(label);
    readline.emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    let value = "";
    const onKey = (str, key = {}) => {
      if (key.ctrl && key.name === "c") return abortPrompt(130);
      if (key.ctrl && key.name === "d") return value ? undefined : abortPrompt(1);
      if (key.name === "return" || key.name === "enter") {
        stdin.removeListener("keypress", onKey);
        stdin.setRawMode(false);
        stdin.pause();
        out.write("\n");
        return resolve(value);
      }
      const chars = Array.from(value);
      if (key.name === "backspace") {
        if (chars.length) out.write(MASK_ERASE);
        value = chars.slice(0, -1).join(""); // whole char, not half an emoji
      } else if (key.ctrl && key.name === "u") {
        out.write(MASK_ERASE.repeat(chars.length));
        value = "";
      } else if (str && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(str)) {
        value += str; // skip arrows, tab, etc.
        out.write(mask(Array.from(str).length));
      }
    };
    stdin.on("keypress", onKey);
  });
}

// piped stdin: keep one reader so lines that arrive early are queued, not lost
let piped;
function readPipedLine(label) {
  if (!piped) {
    piped = { lines: [], waiting: null, closed: false };
    piped.rl = readline.createInterface({ input: process.stdin, terminal: false, crlfDelay: Infinity }); // \r\n = one line (Windows)
    piped.rl.on("line", (line) => (piped.waiting ? piped.waiting(line) : piped.lines.push(line)));
    piped.rl.on("close", () => ((piped.closed = true), piped.waiting && abortPrompt(1)));
  }
  promptOut().write(label);
  return new Promise((resolve) => {
    const done = (line) => {
      piped.waiting = null;
      piped.rl.pause(); // lets the process exit when no more questions come
      promptOut().write("\n"); // piped answers aren't echoed
      resolve(line);
    };
    if (piped.lines.length) return done(piped.lines.shift());
    if (piped.closed) return abortPrompt(1);
    piped.waiting = done;
    piped.rl.resume();
  });
}

async function prompt(questions) {
  const { colors: c } = require("./index"); // here, not at the top: index.js loads this file, so its exports are only ready at call time
  const tty = Boolean(process.stdin.isTTY);
  const read = (label, type) => (!tty ? readPipedLine(label) : type === "password" ? readTtyPassword(label) : readTtyLine(label));
  const answers = {};
  for (const q of questions) {
    // website look: "? MASTER PASSWORD: ••••••" with a gray "?", off-white question and dim hints
    const hint = q.type === "confirm" ? c.dim(q.default === false ? " (y/N)" : " (Y/n)") : "";
    const label = c.gray("? ") + c.text(String(q.message).trim()) + hint + " ";
    // Git Bash/mintty without winpty: no terminal, so the terminal itself echoes what you type
    if (q.type === "password" && !tty && process.env.MSYSTEM && !process.stdout.isTTY)
      process.stderr.write(c.yellow("warning: input will be visible, run with: winpty node ...\n"));
    let answer = await read(label, q.type);
    if (q.type === "confirm") {
      while (!/^(y(es)?|no?|)$/i.test(answer.trim())) answer = await read(label, q.type); // re-ask on junk
      answer = answer.trim() === "" ? q.default !== false : /^y/i.test(answer.trim());
    } else if (answer === "" && q.default !== undefined) answer = q.default;
    answers[q.name] = answer;
  }
  return answers;
}

module.exports = prompt;
