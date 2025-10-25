#!/bin/bash
set -e

echo "🚀 Updating Prodex files with priorityFiles feature..."

# 1️⃣ src/constants/config-loader.js
cat <<'EOF' > src/constants/config-loader.js
import fs from "fs";
import path from "path";
import {
  ROOT,
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

  const outputDir = userConfig.output
    ? path.resolve(ROOT, userConfig.output)
    : path.join(ROOT, "prodex");

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
    limit: userConfig.limit || 200,
    priorityFiles: userConfig.priorityFiles || []
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
EOF

# 2️⃣ src/core/helpers.js
cat <<'EOF' > src/core/helpers.js
import fs from "fs";
import path from "path";
import { ROOT, CODE_EXTS, ENTRY_EXCLUDES } from "../constants/config.js";

export function rel(p) {
  return path.relative(ROOT, p).replaceAll("\\", "/");
}

export function read(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

export function normalizeIndent(s) {
  return s
    .replace(/\t/g, "  ")
    .split("\n")
    .map(l => l.replace(/[ \t]+$/, ""))
    .join("\n");
}

export function stripComments(code, ext) {
  if (ext === ".php") {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*#.*$/gm, "");
  }

  let out = "";
  let inStr = false;
  let strChar = "";
  let inBlockComment = false;
  let inLineComment = false;

  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    const next = code[i + 1];

    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inLineComment) {
      if (c === "\n") {
        inLineComment = false;
        out += c;
      }
      continue;
    }

    if (inStr) {
      if (c === "\\" && next) {
        out += c + next;
        i++;
        continue;
      }
      if (c === strChar) inStr = false;
      out += c;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      inStr = true;
      strChar = c;
      out += c;
      continue;
    }

    if (c === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    if (c === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    out += c;
  }

  return out;
}

export function isEntryExcluded(p) {
  const r = rel(p);
  return ENTRY_EXCLUDES.some(ex => r.startsWith(ex) || r.includes(ex));
}

export function* walk(dir, depth = 0, maxDepth = 2) {
  if (depth > maxDepth) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, depth + 1, maxDepth);
    else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      const relPath = rel(full);
      if (CODE_EXTS.includes(ext) && !ENTRY_EXCLUDES.some(ex => relPath.startsWith(ex))) {
        yield full;
      }
    }
  }
}

export function sortWithPriority(files, priorityList = []) {
  if (!priorityList.length) return files;
  const prioritized = [];
  const normal = [];

  for (const f of files) {
    const normalized = f.replaceAll("\\", "/").toLowerCase();
    if (priorityList.some(p => normalized.includes(p.toLowerCase()))) prioritized.push(f);
    else normal.push(f);
  }

  return [...new Set([...prioritized, ...normal])];
}
EOF

# 3️⃣ src/cli/picker.js
cat <<'EOF' > src/cli/picker.js
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import { ROOT } from "../constants/config.js";
import { walk, rel, sortWithPriority } from "../core/helpers.js";

export async function pickEntries(baseDirs, depth = 2, cfg = {}) {
  let selected = [];
  while (true) {
    const files = [];
    for (const base of baseDirs) {
      const full = path.join(ROOT, base);
      if (!fs.existsSync(full)) continue;
      for (const f of walk(full, 0, depth)) files.push(f);
    }

    const sorted = sortWithPriority(files, cfg.priorityFiles);

    const prioritized = sorted.filter(f =>
      cfg.priorityFiles?.some(p =>
        rel(f).replaceAll("\\", "/").toLowerCase().includes(p.toLowerCase())
      )
    );

    const choices = sorted.map(f => ({
      name: prioritized.includes(f) ? `⭐ ${rel(f)}` : rel(f),
      value: f
    }));

    if (prioritized.length) {
      choices.unshift(new inquirer.Separator("⭐ Recommended entries"));
      choices.splice(prioritized.length + 1, 0, new inquirer.Separator("─ Other files"));
    }

    const { picks } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "picks",
        message: `Select entry files (depth ${depth})`,
        choices,
        loop: false,
        pageSize: 20,
        default: selected
      }
    ]);

    if (picks.includes("__manual")) {
      const { manual } = await inquirer.prompt([
        { name: "manual", message: "Enter relative path:" }
      ]);
      if (manual.trim()) selected.push(path.resolve(ROOT, manual.trim()));
    }

    if (picks.includes("__loadmore")) {
      depth++;
      selected = picks.filter(p => !["__manual", "__loadmore"].includes(p));
      continue;
    }

    selected = picks.filter(p => !["__manual", "__loadmore"].includes(p));
    break;
  }
  return [...new Set(selected)];
}
EOF

# 4️⃣ src/core/combine.js
cat <<'EOF' > src/core/combine.js
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import {
  ROOT,
  CODE_EXTS,
  RESOLVERS,
  PROMPTS
} from "../constants/config.js";
import { loadProdexConfig } from "../constants/config-loader.js";
import { read, normalizeIndent, stripComments, rel } from "./helpers.js";
import { pickEntries } from "../cli/picker.js";
import { showSummary } from "../cli/summary.js";
import { generateOutputName, resolveOutputPath } from "./file-utils.js";

export async function runCombine() {
  const cliLimitFlag = process.argv.find(arg => arg.startsWith("--limit="));
  const customLimit = cliLimitFlag ? parseInt(cliLimitFlag.split("=")[1], 10) : null;

  const cfg = loadProdexConfig();
  const { baseDirs, scanDepth } = cfg;

  const entries = await pickEntries(baseDirs, scanDepth, cfg);
  if (!entries.length) {
    console.log("❌ No entries selected.");
    return;
  }

  const autoName = generateOutputName(entries);
  const outputDir = cfg.output || path.join(ROOT, "prodex");
  const defaultLimit = customLimit || cfg.limit || 200;

  console.log("\n📋 You selected:");
  for (const e of entries) console.log(" -", rel(e));

  const { yesToAll } = await inquirer.prompt([PROMPTS.yesToAll]);

  let outputBase = autoName,
    limit = defaultLimit,
    chain = true,
    proceed = true;

  if (!yesToAll) {
    const combinePrompts = PROMPTS.combine.map(p => ({
      ...p,
      default:
        p.name === "outputBase"
          ? autoName
          : p.name === "limit"
            ? defaultLimit
            : p.default
    }));

    const ans = await inquirer.prompt(combinePrompts);
    outputBase = ans.outputBase || autoName;
    limit = ans.limit;
    chain = ans.chain;
    proceed = ans.proceed;
  }

  if (!proceed) {
    console.log("⚙️  Aborted.");
    return;
  }

  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch {
    console.warn("⚠️  Could not create output directory:", outputDir);
  }

  const output = resolveOutputPath(outputDir, outputBase);

  showSummary({
    outputDir,
    fileName: path.basename(output),
    entries,
    scanDepth: cfg.scanDepth,
    limit,
    chain
  });

  const finalFiles = chain ? await followChain(entries, limit) : entries;

  fs.writeFileSync(
    output,
    [toc(finalFiles), ...finalFiles.map(render)].join(""),
    "utf8"
  );

  console.log(`\n✅ ${output} written (${finalFiles.length} file(s)).`);
}

function header(p) {
  return `##==== path: ${rel(p)} ====`;
}
function regionStart(p) {
  return `##region ${rel(p)}`;
}
const regionEnd = "##endregion";

function render(p) {
  const ext = path.extname(p);
  let s = read(p);
  return `${header(p)}\n${regionStart(p)}\n${s}\n${regionEnd}\n\n`;
}

function toc(files) {
  return (
    ["##==== Combined Scope ====", ...files.map(f => "## - " + rel(f))].join(
      "\n"
    ) + "\n\n"
  );
}

async function followChain(entryFiles, limit = 200) {
  console.log("🧩 Following dependency chain...");
  const visited = new Set();
  const all = [];

  for (const f of entryFiles) {
    if (visited.has(f)) continue;
    all.push(f);

    const ext = path.extname(f);
    if (!CODE_EXTS.includes(ext)) continue;

    const resolver = RESOLVERS[ext];
    if (resolver) {
      const { files } = await resolver(f, visited);
      all.push(...files);
    }

    if (all.length >= limit) {
      console.log("⚠️  Limit reached:", limit);
      break;
    }
  }

  return [...new Set(all)];
}
EOF

# 5️⃣ src/cli/init.js
cat <<'EOF' > src/cli/init.js
import fs from "fs";
import path from "path";
import inquirer from "inquirer";

export async function initProdex() {
  console.log("🪄 Prodex Init — Configuration Wizard\n");

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
  "$schema": "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
  "output": "prodex",
  "scanDepth": 2,
  "limit": 200,
  "baseDirs": ["app", "routes", "resources/js"],
  "aliasOverrides": {
    "@hooks": "resources/js/hooks",
    "@data": "resources/js/data"
  },
  "priorityFiles": [
    "routes/web.php",
    "routes/api.php",
    "index",
    "main",
    "app"
  ],
  "entryExcludes": [
    "resources/js/components/ui/",
    "app/DTOs/"
  ],
  "importExcludes": [
    "node_modules",
    "@shadcn/"
  ]
}
`;

  fs.writeFileSync(dest, jsonc, "utf8");
  console.log(`✅ Created ${dest}`);
  console.log("💡 You can edit it anytime or rerun 'prodex init' to reset.");
}
EOF

# 6️⃣ schema/prodex.schema.json
cat <<'EOF' > schema/prodex.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Prodex Configuration Schema",
  "type": "object",
  "properties": {
    "output": { "type": "string" },
    "scanDepth": { "type": "integer" },
    "limit": { "type": "integer" },
    "baseDirs": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "aliasOverrides": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "entryExcludes": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "importExcludes": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "priorityFiles": {
      "type": "array",
      "description": "List of files (partial names) prioritized in the entry picker.",
      "items": { "type": "string" },
      "default": []
    }
  },
  "required": []
}
EOF

# 7️⃣ README.md
cat <<'EOF' > README.md
# 🧩 Prodex — Unified Project Indexer & Dependency Extractor

> **Prodex** *(short for “Project Index”)* — a cross-language dependency combiner for modern full-stack applications.  
> Traverses **Laravel + React + TypeScript** projects to generate a single, organized view of your project’s true dependency scope.

---

## 🧠 Recent Fixes & Updates — v1.0.4

- 🪟 **Windows path resolution fixed** — now uses proper `file://` URLs for full ESM compatibility.  
- 🧾 **Improved output naming** — automatic, context-aware filenames (e.g. `prodex-[entries]-combined.txt`).  
- ⚙️ **“Yes to all” confirmation added** — skip repetitive prompts during CLI runs.

---

## 🚀 Features

| Feature | Description |
|----------|-------------|
| ⚙️ **Cross-language resolver** | Parses JS/TS (`import`, `export`) and PHP (`use`, `require`, `include`) dependency trees. |
| 🧭 **Alias detection** | Reads `tsconfig.json` and `vite.config.*` for alias paths (`@/components/...`). |
| 🧩 **Laravel-aware** | Maps PSR-4 namespaces and detects providers under `app/Providers`. |
| 🔄 **Recursive chain following** | Resolves dependency graphs up to a configurable depth and file limit. |
| 🪶 **Clean unified output** | Merges all resolved files into a single `.txt` file with region markers for readability. |
| 🧠 **Static & safe** | Fully static parsing — no runtime execution or file modification. |
| 💬 **Interactive CLI** | Select files, confirm settings, or use “Yes to all” for streamlined automation. |

---

## ⚙️ Configuration

Optional `.prodex.json` (in project root):

```json
{
  "$schema": "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
  "output": "prodex",
  "scanDepth": 2,
  "limit": 200,
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
}
EOF