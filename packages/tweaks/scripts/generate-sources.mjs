import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = join(root, "src", "scripts");
const outPath = join(root, "src", "scriptSources.ts");

const names = readdirSync(scriptsDir).filter((f) => f.endsWith(".js")).sort();
const entries = names.map((name) => {
  const key = name.replace(/\.js$/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return `  ${key}: ${JSON.stringify(readFileSync(join(scriptsDir, name), "utf8"))},`;
});

writeFileSync(
  outPath,
  `export const TWEAK_SCRIPTS = {\n${entries.join("\n")}\n} as const;\n\nexport type TweakScriptName = keyof typeof TWEAK_SCRIPTS;\n`,
);
console.log(`wrote ${outPath} (${names.length} scripts)`);
