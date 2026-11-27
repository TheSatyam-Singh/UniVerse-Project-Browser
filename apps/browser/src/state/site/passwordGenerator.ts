import { secureRandomHex } from "../../platform/secureRandom";

export const MIN_GENERATED_PASSWORD_LENGTH = 8;
export const MAX_GENERATED_PASSWORD_LENGTH = 64;
export const DEFAULT_GENERATED_PASSWORD_LENGTH = 16;

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?";

export type PasswordGeneratorOptions = {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
};

export const defaultPasswordGeneratorOptions = (): PasswordGeneratorOptions => ({
  length: DEFAULT_GENERATED_PASSWORD_LENGTH,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
});

export function normalizePasswordGeneratorOptions(options: PasswordGeneratorOptions): PasswordGeneratorOptions {
  const noneOn = !options.lowercase && !options.uppercase && !options.numbers && !options.symbols;
  return {
    length: Math.max(MIN_GENERATED_PASSWORD_LENGTH, Math.min(MAX_GENERATED_PASSWORD_LENGTH, Math.floor(options.length) || DEFAULT_GENERATED_PASSWORD_LENGTH)),
    lowercase: noneOn || options.lowercase,
    uppercase: noneOn || options.uppercase,
    numbers: noneOn || options.numbers,
    symbols: noneOn || options.symbols,
  };
}

type RandomHex = (length: number) => string;

const byteStream = (randomHex: RandomHex) => {
  let bytes: number[] = [];
  let at = 0;
  const next = (): number => {
    if (at >= bytes.length) {
      const hex = randomHex(64);
      bytes = Array.from({ length: hex.length / 2 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
      at = 0;
    }
    return bytes[at++]!;
  };
  return { next };
};

const pickIndex = (stream: ReturnType<typeof byteStream>, size: number): number => {
  const limit = Math.floor(256 / size) * size;
  let value = stream.next();
  while (value >= limit) value = stream.next();
  return value % size;
};

export function generatePassword(options: PasswordGeneratorOptions, randomHex: RandomHex = secureRandomHex): string {
  const normalized = normalizePasswordGeneratorOptions(options);
  const sets = [
    normalized.lowercase ? LOWERCASE : "",
    normalized.uppercase ? UPPERCASE : "",
    normalized.numbers ? DIGITS : "",
    normalized.symbols ? SYMBOLS : "",
  ].filter((set) => set.length > 0);
  const pool = sets.join("");
  const stream = byteStream(randomHex);
  const chars = sets.map((set) => set[pickIndex(stream, set.length)]!);
  while (chars.length < normalized.length) chars.push(pool[pickIndex(stream, pool.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = pickIndex(stream, i + 1);
    const held = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = held;
  }
  return chars.join("");
}
