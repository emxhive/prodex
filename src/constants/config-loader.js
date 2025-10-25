import fs from "fs";
import path from "path";
import {
  ROOT,
  OUT_FILE,
  CODE_EXTS,
  ENTRY_EXCLUDES,
  IMPORT_EXCLUDES,
  BASE_DIRS
} from "./config.js";

/**
 * Loads and merges the Prodex configuration.
 *  - `output` is treated strictly as a directory.
 *  - Defaults to ROOT/prodex when not defined.
 */
export function loadProdexConfig() {
  const configPath = path.join(ROOT, ".prodex.json");
  let userConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      const data = fs.readFileSync(configPath, "utf8");
      userConfig = JSON.parse(data);
      console.log("? Loaded .prodex.json overrides");
    } catch (err) {
      console.warn("??  Failed to parse .prodex.json:", err.message);
    }
  }

  // Resolve output directory (always a folder now)
  const outputDir = userConfig.output
    ? path.resolve(ROOT, userConfig.output)
    : path.join(ROOT, "prodex");

  // Ensure directory exists
  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (e) {
    console.warn("??  Could not create output directory:", outputDir);
  }

  const merged = {
    output: outputDir,
    scanDepth: userConfig.scanDepth || 2,
    codeExts: userConfig.codeExts || CODE_EXTS,
    entryExcludes: [...ENTRY_EXCLUDES, ...(userConfig.entryExcludes || [])],
    importExcludes: [...IMPORT_EXCLUDES, ...(userConfig.importExcludes || [])],
    baseDirs: [...new Set([...(userConfig.baseDirs || []), ...BASE_DIRS])],
    aliasOverrides: userConfig.aliasOverrides || {},
    limit: userConfig.limit || 200
  };

  console.log("?? Active Config:");
  console.log(" • Output Directory:", merged.output);
  console.log(" • Scan Depth:", merged.scanDepth);
  console.log(" • Base Dirs:", merged.baseDirs.join(", "));
  if (userConfig.entryExcludes || userConfig.importExcludes)
    console.log(" • Custom Exclusions:", {
      entries: userConfig.entryExcludes?.length || 0,
      imports: userConfig.importExcludes?.length || 0
    });

  return merged;
}
