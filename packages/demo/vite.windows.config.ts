import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import base from "./vite.config";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const windowsShims = here("./src/windows/");

export default defineConfig({
  ...base,
  resolve: {
    ...base.resolve,
    alias: [
      { find: /^@universe\/universecore$/, replacement: `${windowsShims}universecore.windows.tsx` },
      { find: /^@universe\/shell$/, replacement: `${windowsShims}shell.windows.tsx` },
      ...(base.resolve?.alias ?? []),
    ],
  },
  build: {
    ...base.build,
    outDir: "../../apps/windows/Universe.Windows/Assets/WebUI",
    emptyOutDir: false,
  },
});
