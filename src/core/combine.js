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

  const entries = await pickEntries(baseDirs, scanDepth);
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
    // clone static prompts with dynamic defaults
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

  // ensure output directory exists
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
  s = stripComments(s, ext);
  s = normalizeIndent(s);
  return `${header(p)}\n${regionStart(p)}\n${s}\n${regionEnd}\n\n`;
}

function toc(files) {
  return (
    ["// ==== Combined Scope ====", ...files.map(f => "// - " + rel(f))].join(
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
