#!/usr/bin/env bash
set -e

echo "🚀 Setting up Prodex v1.1.0 (with config init)..."

# Clean setup
mkdir -p bin src/{core,resolvers,cli,constants} schema

# -----------------------------
# package.json
# -----------------------------
cat > package.json <<'EOF'
{
  "name": "prodex",
  "version": "1.1.0",
  "type": "module",
  "bin": { "prodex": "bin/prodex.js" },
  "dependencies": {
    "inquirer": "^10.0.0"
  },
  "description": "Prodex — Project Dependency Extractor. Flatten, analyze, and index your repo into a single structured file.",
  "keywords": ["combine", "flatten", "repo", "laravel", "vite", "typescript", "php", "prodex"],
  "license": "MIT",
  "author": "Zeki"
}
EOF

# -----------------------------
# CLI entry router
# -----------------------------
cat > bin/prodex.js <<'EOF'
#!/usr/bin/env node
import("../src/index.js").then(({ default: startProdex }) => startProdex());
EOF
chmod +x bin/prodex.js

# -----------------------------
# src/index.js
# -----------------------------
cat > src/index.js <<'EOF'
import { runCombine } from "./core/combine.js";
import { initProdex } from "./cli/init.js";

export default async function startProdex() {
  const args = process.argv.slice(2);
  if (args.includes("init")) return await initProdex();

  console.clear();
  console.log("🧩 Prodex — Project Dependency Extractor\\n");
  await runCombine();
}
EOF

# -----------------------------
# src/cli/init.js
# -----------------------------
cat > src/cli/init.js <<'EOF'
import fs from "fs";
import path from "path";
import inquirer from "inquirer";

export async function initProdex() {
  console.log("🪄 Prodex Init — Configuration Wizard\\n");

  const dest = path.join(process.cwd(), ".prodex.json");
  if (fs.existsSync(dest)) {
    const { overwrite } = await inquirer.prompt([
      { type: "confirm", name: "overwrite", message: ".prodex.json already exists. Overwrite?", default: false }
    ]);
    if (!overwrite) {
      console.log("❌ Cancelled.");
      return;
    }
  }

  const jsonc = `{
  // -------------------------------------------------------------
  // 🧩 Prodex Configuration
  // -------------------------------------------------------------
  // Customize how Prodex flattens your project.
  // For docs, visit: https://github.com/emxhive/prodex#configuration
  // -------------------------------------------------------------

  "$schema": "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",

  "output": "combined.txt",
  "scanDepth": 2,
  "baseDirs": ["app", "routes", "resources/js"],
  "aliasOverrides": {
    "@hooks": "resources/js/hooks",
    "@data": "resources/js/data"
  },
  "entryExcludes": [
    "resources/js/components/ui/",
    "app/DTOs/"
  ],
  "importExcludes": [
    "node_modules",
    "@shadcn/"
  ]
}`;

  fs.writeFileSync(dest, jsonc, "utf8");
  console.log(`✅ Created ${dest}`);
  console.log("💡 You can edit it anytime or rerun 'prodex init' to reset.");
}
EOF

# -----------------------------
# src/constants/config-loader.js
# -----------------------------
cat > src/constants/config-loader.js <<'EOF'
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

export function loadProdexConfig() {
  const configPath = path.join(ROOT, ".prodex.json");
  let userConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      const data = fs.readFileSync(configPath, "utf8");
      userConfig = JSON.parse(data);
      console.log("🧠 Loaded .prodex.json overrides");
    } catch (err) {
      console.warn("⚠️  Failed to parse .prodex.json:", err.message);
    }
  }

  const merged = {
    output: userConfig.output || OUT_FILE,
    scanDepth: userConfig.scanDepth || 2,
    codeExts: userConfig.codeExts || CODE_EXTS,
    entryExcludes: [...ENTRY_EXCLUDES, ...(userConfig.entryExcludes || [])],
    importExcludes: [...IMPORT_EXCLUDES, ...(userConfig.importExcludes || [])],
    baseDirs: [...new Set([...(userConfig.baseDirs || []), ...BASE_DIRS])],
    aliasOverrides: userConfig.aliasOverrides || {}
  };

  console.log("🧩 Active Config:");
  console.log(" • Output:", merged.output);
  console.log(" • Scan Depth:", merged.scanDepth);
  console.log(" • Base Dirs:", merged.baseDirs.join(", "));
  if (userConfig.entryExcludes || userConfig.importExcludes)
    console.log(" • Custom Exclusions:", {
      entries: userConfig.entryExcludes?.length || 0,
      imports: userConfig.importExcludes?.length || 0
    });

  return merged;
}
EOF

# -----------------------------
# src/constants/config.js (unchanged)
# -----------------------------
cat > src/constants/config.js <<'EOF'
export const ROOT = process.cwd();
export const OUT_FILE = ROOT + "/combined.txt";
export const CODE_EXTS = [".ts", ".tsx", ".d.ts", ".php"];
export const ENTRY_EXCLUDES = [
  "resources/js/components/ui/",
  "app/Enums/",
  "app/DTOs/",
  "app/Models/",
  "app/Data/",
  "resources/js/wayfinder/",
  "resources/js/routes/",
  "resources/js/actions/",
  "resources/js/hooks/"
];
export const IMPORT_EXCLUDES = [
  "node_modules",
  "@shadcn/",
  "@/components/ui/",
  "@components/ui/",
  "resources/js/components/ui/",
  "resources/js/hooks/",
  "resources/js/wayfinder/",
  "resources/js/routes/",
  "resources/js/actions/"
];
export const BASE_DIRS = ["app", "routes", "resources/js"];
EOF

# -----------------------------
# Schema file
# -----------------------------
cat > schema/prodex.schema.json <<'EOF'
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Prodex Config Schema",
  "type": "object",
  "properties": {
    "output": { "type": "string" },
    "scanDepth": { "type": "number", "minimum": 1 },
    "baseDirs": { "type": "array", "items": { "type": "string" } },
    "aliasOverrides": { "type": "object" },
    "entryExcludes": { "type": "array", "items": { "type": "string" } },
    "importExcludes": { "type": "array", "items": { "type": "string" } }
  },
  "additionalProperties": false
}
EOF

# -----------------------------
# NPM install + link
# -----------------------------
echo "📦 Installing dependencies..."
npm install --silent
npm link --silent

echo "✅ Prodex setup complete!"
echo "Commands available:"
echo "  prodex        -> run combine"
echo "  prodex init   -> generate .prodex.json"