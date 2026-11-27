import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_GENERATED_PASSWORD_LENGTH,
  MAX_GENERATED_PASSWORD_LENGTH,
  MIN_GENERATED_PASSWORD_LENGTH,
  defaultPasswordGeneratorOptions,
  generatePassword,
  normalizePasswordGeneratorOptions,
} from "./passwordGenerator.ts";

const hexFrom = (pattern) => (length) => pattern.repeat(Math.ceil(length / pattern.length)).slice(0, length);
const cycling = hexFrom("0123456789abcdef");
const reversed = hexFrom("fedcba9876543210");

const has = (password, chars) => [...password].some((c) => chars.includes(c));
const allIn = (password, chars) => [...password].every((c) => chars.includes(c));

test("a generated password has the requested length and one character from each chosen set", () => {
  const password = generatePassword(defaultPasswordGeneratorOptions(), cycling);
  assert.equal(password.length, DEFAULT_GENERATED_PASSWORD_LENGTH);
  assert.ok(has(password, "abcdefghijklmnopqrstuvwxyz"));
  assert.ok(has(password, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"));
  assert.ok(has(password, "0123456789"));
  assert.ok(has(password, "!@#$%^&*()-_=+[]{};:,.<>?"));
});

test("a password with only one set enabled uses only that set", () => {
  const onlyLower = generatePassword({ ...defaultPasswordGeneratorOptions(), uppercase: false, numbers: false, symbols: false }, cycling);
  assert.equal(onlyLower.length, DEFAULT_GENERATED_PASSWORD_LENGTH);
  assert.ok(allIn(onlyLower, "abcdefghijklmnopqrstuvwxyz"));
  const onlyDigits = generatePassword({ ...defaultPasswordGeneratorOptions(), lowercase: false, uppercase: false, numbers: true, symbols: false }, cycling);
  assert.ok(allIn(onlyDigits, "0123456789"));
});

test("the requested length is honoured at the bounds", () => {
  assert.equal(generatePassword({ ...defaultPasswordGeneratorOptions(), length: MIN_GENERATED_PASSWORD_LENGTH }, cycling).length, MIN_GENERATED_PASSWORD_LENGTH);
  assert.equal(generatePassword({ ...defaultPasswordGeneratorOptions(), length: MAX_GENERATED_PASSWORD_LENGTH }, cycling).length, MAX_GENERATED_PASSWORD_LENGTH);
});

test("the same random source generates the same password, and a different source a different one", () => {
  const options = defaultPasswordGeneratorOptions();
  assert.equal(generatePassword(options, cycling), generatePassword(options, cycling));
  assert.notEqual(generatePassword(options, cycling), generatePassword(options, reversed));
});

test("lengths outside the bounds are clamped", () => {
  assert.equal(normalizePasswordGeneratorOptions({ ...defaultPasswordGeneratorOptions(), length: 2 }).length, MIN_GENERATED_PASSWORD_LENGTH);
  assert.equal(normalizePasswordGeneratorOptions({ ...defaultPasswordGeneratorOptions(), length: 200 }).length, MAX_GENERATED_PASSWORD_LENGTH);
  assert.equal(normalizePasswordGeneratorOptions({ ...defaultPasswordGeneratorOptions(), length: 24 }).length, 24);
});

test("no character set enabled falls back to all of them", () => {
  const options = { length: 16, lowercase: false, uppercase: false, numbers: false, symbols: false };
  const normalized = normalizePasswordGeneratorOptions(options);
  assert.ok(normalized.lowercase && normalized.uppercase && normalized.numbers && normalized.symbols);
  const password = generatePassword(options, cycling);
  assert.ok(has(password, "abcdefghijklmnopqrstuvwxyz"));
  assert.ok(has(password, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"));
  assert.ok(has(password, "0123456789"));
  assert.ok(has(password, "!@#$%^&*()-_=+[]{};:,.<>?"));
});

test("default options are a fresh object each time", () => {
  const first = defaultPasswordGeneratorOptions();
  first.length = 99;
  assert.equal(defaultPasswordGeneratorOptions().length, DEFAULT_GENERATED_PASSWORD_LENGTH);
});

test("the default random source generates a password of the requested length with every chosen set", () => {
  for (let i = 0; i < 5; i++) {
    const password = generatePassword(defaultPasswordGeneratorOptions());
    assert.equal(password.length, DEFAULT_GENERATED_PASSWORD_LENGTH);
    assert.ok(has(password, "abcdefghijklmnopqrstuvwxyz"));
    assert.ok(has(password, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"));
    assert.ok(has(password, "0123456789"));
    assert.ok(has(password, "!@#$%^&*()-_=+[]{};:,.<>?"));
  }
});
