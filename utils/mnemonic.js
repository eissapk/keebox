// 12-word recovery phrase, BIP39 style: 128 random bits + 4-bit checksum (first bits of sha256), 11 bits per word
const crypto = require("crypto");
const WORDS = require("./wordlist");

const INDEX = new Map(WORDS.map((w, i) => [w, i]));
const WORD_COUNT = 12;
const ENTROPY_BYTES = 16; // 128 bits -> 4 checksum bits -> 132 bits = 12 words

const bits = (buf) => [...buf].map((b) => b.toString(2).padStart(8, "0")).join("");
const checksum = (entropy) => bits(crypto.createHash("sha256").update(entropy).digest()).slice(0, (entropy.length * 8) / 32);

// 16 bytes -> 12 words
function toWords(entropy) {
  if (entropy.length !== ENTROPY_BYTES) throw new Error("entropy must be " + ENTROPY_BYTES + " bytes");
  return (bits(entropy) + checksum(entropy)).match(/.{11}/g).map((b) => WORDS[parseInt(b, 2)]);
}

// a new random phrase -> "word1 word2 ... word12"
function newPhrase() {
  return toWords(crypto.randomBytes(ENTROPY_BYTES)).join(" ");
}

// typed phrase -> words (lowercase, any spacing)
function splitPhrase(phrase) {
  return String(phrase ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

// typed phrase -> what's wrong with it, or null when it's a valid 12-word phrase (catches most typos / swapped words)
function checkPhrase(phrase) {
  const words = splitPhrase(phrase);
  if (words.length !== WORD_COUNT) return "needs " + WORD_COUNT + " words, got " + words.length;
  const unknown = words.filter((w) => !INDEX.has(w));
  if (unknown.length) return "unknown word(s): " + unknown.join(", ");
  const all = words.map((w) => INDEX.get(w).toString(2).padStart(11, "0")).join("");
  const entropy = Buffer.from(all.slice(0, ENTROPY_BYTES * 8).match(/.{8}/g).map((b) => parseInt(b, 2)));
  if (all.slice(ENTROPY_BYTES * 8) !== checksum(entropy)) return "checksum doesn't match (a word is wrong or out of order)";
  return null;
}

// typed phrase -> the exact text used as the scrypt password (so spacing/case don't matter)
function normalizePhrase(phrase) {
  return splitPhrase(phrase).join(" ");
}

module.exports = { toWords, newPhrase, splitPhrase, checkPhrase, normalizePhrase };
