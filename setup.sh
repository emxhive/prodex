#!/bin/bash
set -e

echo "🔧 Refactoring Prodex CLI layout..."

# --- CLI Picker ---
cat > src/cli/picker.js <<'EOF'
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import { ROOT } from "../constants/config.js";
import { walk, rel } from "../core/helpers.js";

export async function pickEntries(baseDirs, depth = 2) {
  let selected = [];
  while (true) {
    const files = [];
    for (const base of baseDirs) {
      const full = path.join(ROOT, base);
      if (!fs.existsSync(full)) continue;
      for (const f of walk(full, 0, depth)) files.push(f);
    }

    const choices = files.map(f => ({ name: rel(f), value: f }));
    choices.push(new inquirer.Separator());
    choices.push({ name: "🔽 Load more (go deeper)", value: "__loadmore" });
    choices.push({ name: "📝 Enter custom path", value: "__manual" });

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

# --- CLI Summary ---
cat > src/cli/summary.js <<'EOF'
export function showSummary({ outputDir, fileName, entries, scanDepth, limit, chain }) {
  console.log("\n🧩 Active Run:");
  console.log(" • Output Directory:", outputDir);
  console.log(" • File Name:", fileName);
  console.log(" • Entries:", entries.length);
  console.log(" • Scan Depth:", scanDepth);
  console.log(" • Limit:", limit);
  console.log(" • Chain:", chain ? "Enabled" : "Disabled");
}
EOF

# --- Core Combine ---
cat > src/core/combine.js <<'EOF'
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import { ROOT } from "../constants/config.js";
import { loadProdexConfig } from "../constants/config-loader.js";
import { read, normalizeIndent, stripComments, rel } from "./helpers.js";
import { resolveJsImports } from "../resolvers/js-resolver.js";
import { resolvePhpImports } from "../resolvers/php-resolver.js";
import { pickEntries } from "../cli/picker.js";
import { showSummary } from "../cli/summary.js";
import { generateOutputName, resolveOutputPath } from "./file-utils.js";

export async function runCombine() {
  const cliLimitFlag = process.argv.find(arg => arg.startsWith("--limit="));
  const customLimit = cliLimitFlag ? parseInt(cliLimitFlag.split("=")[1], 10) : null;

  const cfg = loadProdexConfig();
  const { baseDirs, scanDepth } = cfg;

  const entries = await pickEntries(baseDirs, scanDepth);
  if (!entries.length) {
    console.log("❌ No entries selected.");
    return;
  }

  const autoName = generateOutputName(entries);
  const outputDir = cfg.output || ROOT;
  const defaultLimit = customLimit || cfg.limit || 200;

  console.log("\n📋 You selected:");
  for (const e of entries) console.log(" -", rel(e));

  const { yesToAll } = await inquirer.prompt([
    {
      type: "confirm",
      name: "yesToAll",
      message: "Proceed automatically with default settings (Yes to all)?",
      default: false
    }
  ]);

  let outputBase = autoName, limit = defaultLimit, chain = true, proceed = true;

  if (!yesToAll) {
    const ans = await inquirer.prompt([
      {
        type: "input",
        name: "outputBase",
        message: "Output base name (without extension):",
        default: autoName,
        filter: v => v.trim() || autoName
      },
      {
        type: "number",
        name: "limit",
        message: "Limit number of merged files:",
        default: defaultLimit,
        validate: v => (!isNaN(v) && v > 0) || "Enter a valid positive number"
      },
      {
        type: "confirm",
        name: "chain",
        message: "Follow dependency chain?",
        default: true
      },
      {
        type: "confirm",
        name: "proceed",
        message: "Proceed with combine?",
        default: true
      }
    ]);
    outputBase = ans.outputBase;
    limit = ans.limit;
    chain = ans.chain;
    proceed = ans.proceed;
  }

  if (!proceed) {
    console.log("⚙️  Aborted.");
    return;
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

function header(p) { return `// ==== path: ${rel(p)} ====`; }
function regionStart(p) { return `// #region ${rel(p)}`; }
const regionEnd = "// #endregion";

function render(p) {
  const ext = path.extname(p);
  let s = read(p);
  s = stripComments(s, ext);
  s = normalizeIndent(s);
  return `${header(p)}\n${regionStart(p)}\n${s}\n${regionEnd}\n\n`;
}

function toc(files) {
  return ["// ==== Combined Scope ====", ...files.map(f => "// - " + rel(f))].join("\n") + "\n\n";
}

async function followChain(entryFiles, limit = 200) {
  console.log("🧩 Following dependency chain...");
  const visited = new Set();
  const all = [];

  for (const f of entryFiles) {
    if (visited.has(f)) continue;
    all.push(f);
    const ext = path.extname(f);

    if ([".ts", ".tsx", ".d.ts"].includes(ext)) {
      const { files } = await resolveJsImports(f, visited);
      all.push(...files);
    } else if (ext === ".php") {
      const { files } = await resolvePhpImports(f, visited);
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

# --- Core File Utils ---
cat > src/core/file-utils.js <<'EOF'
import path from "path";

export function generateOutputName(entries) {
  const names = entries.map(f => path.basename(f, path.extname(f)));
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}-${names[1]}`;
  if (names.length > 2) return `${names[0]}-and-${names.length - 1}more`;
  return "unknown";
}

export function resolveOutputPath(outputDir, base) {
  return path.join(outputDir, `prodex-${base}-combined.txt`);
}
EOF

echo "✅ CLI refactor complete."
