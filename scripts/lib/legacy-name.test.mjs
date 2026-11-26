import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const read = (key) => execFileSync("bash", [fileURLToPath(new URL("./legacy-name.sh", import.meta.url)), key], { encoding: "utf8" }).trim();

test("the release scripts can still read the legacy names out of LegacyMigration.swift", () => {
  assert.match(read("appFileName"), /^\w+\.app$/);
  assert.match(read("appName"), /^\w+$/);
  assert.match(read("bundleId"), /^[\w-]+(\.[\w-]+)+$/);
  assert.equal(read("appFileName"), `${read("appName")}.app`);
});
