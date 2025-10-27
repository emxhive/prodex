import fs from "fs";
import path from "path";
import micromatch from "micromatch";
import { DEFAULT_PRODEX_CONFIG } from "./default-config.js";

export function loadProdexConfig() {
  const ROOT = process.cwd();
  const configPath = path.join(ROOT, "prodex.json");
  
if (!fs.existsSync(configPath)) {
  console.log("🪄 No prodex.json found — generating default config...\n");
  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_PRODEX_CONFIG, null, 2) + "\n", "utf8");
}
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    throw new Error(`❌ Invalid prodex.json: ${err.message}`);
  }

  const cfg = {
    outDir: path.resolve(ROOT, raw.outDir || "prodex"),
    scanDepth: raw.scanDepth ?? 2,
    limit: raw.limit ?? 200,

    entry: {
      includes: toArray(raw.entry?.includes ?? []),
      excludes: toArray(raw.entry?.excludes ?? []),
      priority: toArray(raw.entry?.priority ?? [])
    },

    imports: {
      includes: toArray(raw.imports?.includes ?? []),
      excludes: toArray(raw.imports?.excludes ?? []),
      aliases: raw.imports?.aliases ?? {}
    }
  };

  ensureDir(cfg.outDir);

  // // === Validation summary ===
  // console.log("🧩 Prodex Config Loaded\n");
  // console.log(" • outDir Dir:", cfg.outDir);
  // console.log(" • Entry Includes:", shortList(cfg.entry.includes));
  // console.log(" • Entry Excludes:", shortList(cfg.entry.excludes));
  // console.log(" • Import Includes:", shortList(cfg.imports.includes));
  // console.log(" • Import Excludes:", shortList(cfg.imports.excludes));
  // console.log(" • Aliases:", Object.keys(cfg.imports.aliases).length);

  return cfg;
}

/**
 * Utility — ensures array normalization.
 */
function toArray(v) {
  return Array.isArray(v) ? v : v ? [v] : [];
}

/**
 * Utility — ensure directory exists.
 */
function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {
    console.warn("⚠️  Could not create outDir directory:", p);
  }
}

/**
 * Utility — shortens list for display.
 */
function shortList(list) {
  if (!list.length) return "(none)";
  return list.length > 3 ? list.slice(0, 3).join(", ") + "..." : list.join(", ");
}

/**
 * Glob matcher factory
 * Creates helpers for downstream modules.
 */
export function makeGlobChecker(patterns) {
  const safe = toArray(patterns);
  if (!safe.length) return () => false;
  return (input) => micromatch.isMatch(input.replaceAll("\\", "/"), safe);
}
