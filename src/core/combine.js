import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import { ROOT } from "../constants/config.js";
import { loadProdexConfig } from "../constants/config-loader.js";
import { read, normalizeIndent, stripComments, walk, rel } from "./helpers.js";
import { resolveJsImports } from "../resolvers/js-resolver.js";
import { resolvePhpImports } from "../resolvers/php-resolver.js";

export async function runCombine() {
  const cfg = loadProdexConfig();
  const { output, baseDirs, scanDepth } = cfg;
  const entries = await pickEntries(baseDirs, scanDepth);
  if (!entries.length) { console.log("❌ No entries selected."); return; }

  const { chain, limit, proceed } = await pickSettings(entries);
  if (!proceed) { console.log("⚙️  Aborted."); return; }

  const finalFiles = chain ? await followChain(entries, limit) : entries;
  fs.writeFileSync(output, [toc(finalFiles), ...finalFiles.map(render)].join(""), "utf8");
  console.log(`\n✅ ${output} written (${finalFiles.length} file(s)).`);
}

// ---------- UI ----------
async function pickEntries(baseDirs, depth = 2) {
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

    const { picks } = await inquirer.prompt([{ type: "checkbox", name: "picks", message: `Select entry files (depth \${depth})`, choices, loop: false, pageSize: 20, default: selected }]);
    if (picks.includes("__manual")) {
      const { manual } = await inquirer.prompt([{ name: "manual", message: "Enter relative path:" }]);
      if (manual.trim()) selected.push(path.resolve(ROOT, manual.trim()));
    }
    if (picks.includes("__loadmore")) { depth++; selected = picks.filter(p => !["__manual", "__loadmore"].includes(p)); continue; }
    selected = picks.filter(p => !["__manual", "__loadmore"].includes(p));
    break;
  }
  return [...new Set(selected)];
}

async function pickSettings(entries) {
  console.log("\\nYou selected:");
  for (const e of entries) console.log(" -", rel(e));
  const ans = await inquirer.prompt([
    { type: "confirm", name: "chain", message: "Follow dependency chain?", default: true },
    { type: "number", name: "limit", message: "Limit number of merged files:", default: 200, validate: v => (!isNaN(v) && v > 0) || "Enter valid number" },
    { type: "confirm", name: "proceed", message: "Proceed with combine?", default: true }
  ]);
  return ans;
}

// ---------- Combine logic ----------
function header(p) { return `// ==== path: \${rel(p)} ====`; }
function regionStart(p) { return `// #region \${rel(p)}`; }
const regionEnd = "// #endregion";
function render(p) {
  const ext = path.extname(p);
  let s = read(p);
  s = stripComments(s, ext);
  s = normalizeIndent(s);
  return `\${header(p)}\\n\${regionStart(p)}\\n\${s}\\n\${regionEnd}\\n\\n`;
}
function toc(files) { return ["// ==== Combined Scope ====", ...files.map(f => "// - " + rel(f))].join("\\n") + "\\n\\n"; }

async function followChain(entryFiles, limit = 200) {
  const visited = new Set(); const all = [];
  for (const f of entryFiles) {
    if (visited.has(f)) continue;
    visited.add(f); all.push(f);
    const ext = path.extname(f);
    if ([".ts", ".tsx", ".d.ts"].includes(ext)) {
      const { files } = await resolveJsImports(f, visited);
      all.push(...files);
    } else if (ext === ".php") {
      const { files } = await resolvePhpImports(f, visited);
      all.push(...files);
    }
    if (all.length >= limit) break;
  }
  return [...new Set(all)];
}
