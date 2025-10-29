// @ts-nocheck

import fs from "fs";
import path from "path";

let cacheByRoot = new Map();

export function loadProjectAliases(root) {
  if (cacheByRoot.has(root)) return cacheByRoot.get(root);

  const aliases = {};

  const tsPath = path.join(root, "tsconfig.json");
  const viteJs = path.join(root, "vite.config");
  const viteTs = path.join(root, "vite.config.ts");

  if (fs.existsSync(tsPath)) {
    try {
      const ts = JSON.parse(fs.readFileSync(tsPath, "utf8"));
      const paths = ts.compilerOptions?.paths || {};
      for (const [key, value] of Object.entries(paths)) {
        const cleanedKey = key.replace(/\/\*$/, "");
        const first = Array.isArray(value) ? value[0] : value;
        if (!first) continue;
        const cleanedVal = first.replace(/\/\*$/, "");
        aliases[cleanedKey] = path.resolve(root, cleanedVal);
      }
    } catch {}
  }

  for (const vitePath of [viteJs, viteTs]) {
    if (!fs.existsSync(vitePath)) continue;
    try {
      const content = fs.readFileSync(vitePath, "utf8");
      const blocks = [...content.matchAll(/alias\s*:\s*\{([^}]+)\}/g)];
      for (const m of blocks) {
        const inner = m[1];
        const pairs = [...inner.matchAll(/['"](.+?)['"]\s*:\s*['"](.+?)['"]/g)];
        for (const [, key, val] of pairs) {
          const abs = path.isAbsolute(val) ? val : path.resolve(root, val);
          aliases[key] = abs;
        }
      }
    } catch {}
  }

  cacheByRoot.set(root, aliases);
  return aliases;
}
