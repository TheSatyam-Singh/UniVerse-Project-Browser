import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const readTree = (dir, exts) => {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".turbo") continue;
        walk(p);
      } else if (exts.some((e) => entry.name.endsWith(e))) out.push(p);
    }
  };
  walk(dir);
  return out;
};

const capitalized = (s) => s[0].toUpperCase() + s.slice(1);

test("native engine module names match what the JS requires", () => {
  const engineCall = readFileSync(join(root, "packages/universecore/ios/EngineCall.swift"), "utf8");
  const nativePrefix = engineCall.match(/var moduleName: String \{ "([^"\\]*)\\\(domain/)?.[1];
  assert.ok(nativePrefix, "EngineCall.swift must define moduleName from a literal prefix");

  const jsCall = readFileSync(join(root, "packages/universecore/src/engine/call.ts"), "utf8");
  const jsPrefix = jsCall.match(/requireNativeModule<DomainModule>\(`([^$]*)\$\{domain/)?.[1];
  assert.ok(jsPrefix, "engine/call.ts domainModule must build the module name from a literal prefix");
  assert.equal(nativePrefix, jsPrefix, "native CallTable prefix and JS domainModule prefix must agree");

  const nativeNames = new Set();
  for (const file of readTree(join(root, "packages"), [".swift"])) {
    const text = readFileSync(file, "utf8");
    for (const [, name] of text.matchAll(/Name\("([^"]+)"\)/g)) nativeNames.add(name);
    for (const [, domain] of text.matchAll(/CallTable\(domain: "([^"]+)"/g)) {
      nativeNames.add(`${nativePrefix}${capitalized(domain)}`);
    }
  }

  const jsNames = new Set();
  for (const file of readTree(join(root, "apps/browser/src"), [".ts", ".tsx"])) {
    const text = readFileSync(file, "utf8");
    for (const [, name] of text.matchAll(/(?:requireNativeModule|nativeModule)\("([^"]+)"\)/g)) jsNames.add(name);
  }
  for (const file of readTree(join(root, "packages"), [".ts", ".tsx"])) {
    if (file.includes("node_modules")) continue;
    const text = readFileSync(file, "utf8");
    for (const [, name] of text.matchAll(/(?:requireNativeModule|nativeModule)\("([^"]+)"\)/g)) jsNames.add(name);
  }

  const missing = [...jsNames].filter((name) => !nativeNames.has(name));
  assert.deepEqual(missing, [], `JS requires native modules with no native registration: ${missing.join(", ")}`);
});
