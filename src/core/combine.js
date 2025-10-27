import fs from "fs";
import inquirer from "inquirer";
import path from "path";
import micromatch from "micromatch";
import { pickEntries } from "../cli/picker.js";
import { showSummary } from "../cli/summary.js";
import { loadProdexConfig } from "../constants/config-loader.js";
import { CODE_EXTS, RESOLVERS, ROOT } from "../constants/config.js";
import { generateOutputName, resolveOutDirPath, safeMicromatchScan } from "./file-utils.js";
import { renderMd, renderTxt, tocMd, tocTxt } from "./renderers.js";


export async function runCombine(opts = {}) {
  const cliLimitFlag = process.argv.find(arg => arg.startsWith("--limit="));
  const customLimit = cliLimitFlag ? parseInt(cliLimitFlag.split("=")[1], 10) : null;
  const cliTxtFlag = process.argv.includes("--txt");

  const cfg = loadProdexConfig();
  const { scanDepth } = cfg;

  let entries = opts.entries;

  // 🧩 Headless mode: expand globs manually
  if (entries && entries.length) {
    const all = [];
    for (const pattern of entries) {
      const abs = path.resolve(process.cwd(), pattern);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        // direct file path (no glob)
        all.push(abs);
        continue;
      }

      // glob pattern
      const result = safeMicromatchScan(pattern, {
        cwd: process.cwd(),
        absolute: true,
      });
      if (result?.files?.length) all.push(...result.files);
    }
    entries = [...new Set(all)];
  } else {
    // fallback to interactive picker
    entries = await pickEntries(cfg.entry.includes, scanDepth, cfg);
  }


  if (!entries.length) {
    console.log("❌ No entries selected.");
    return;
  }

  console.log("\n📋 You selected:");
  for (const e of entries) console.log(" -", e.replace(ROOT + "/", ""));

  // 🧩 Auto name suggestion
  const autoName = generateOutputName(entries);
  const outDir = cfg.outDir || path.join(ROOT, "prodex");
  const limit = customLimit || cfg.limit || 200;
  const chain = true;

  // Skip prompt if entries were passed directly
  let outputBase = autoName;
  if (!opts.entries?.length) {
    const { outputBase: answer } = await inquirer.prompt([
      {
        type: "input",
        name: "outputBase",
        message: "Output file name (without extension):",
        default: autoName,
        filter: v => (v.trim() || autoName).replace(/[<>:"/\\|?*]+/g, "_"),
      },
    ]);
    outputBase = answer;
  }

  // Ensure output directory exists
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch {
    console.warn("⚠️  Could not create outDir directory:", outDir);
  }

  const outputPath = resolveOutDirPath(outDir, outputBase, cliTxtFlag);

  showSummary({ outDir, fileName: path.basename(outputPath), entries });


  const result = chain ? await followChain(entries, cfg, limit) : { files: entries, stats: { totalImports: 0, totalResolved: 0 } };
  const sorted = [...result.files].sort((a, b) => a.localeCompare(b));

  const content = cliTxtFlag
    ? [tocTxt(sorted), ...sorted.map(renderTxt)].join("")
    : [tocMd(sorted), ...sorted.map((f, i) => renderMd(f, i === 0))].join("\n");

  fs.writeFileSync(outputPath, content, "utf8");
  console.log(
    `\n✅ ${outputPath}`
  );
  // 🧩 Print resolver summary (clean version)
  console.log(`\n🧩 Summary:
 • Unique imports expected: ${result.stats.expected.size}
 • Unique imports resolved: ${result.stats.resolved.size}
`);
}

async function followChain(entryFiles, cfg, limit = 200) {
  console.log("🧩 Following dependency chain...");
  const visited = new Set();
  const all = [];
  const expected = new Set();
  const resolved = new Set();
  const resolverDepth = cfg.resolverDepth ?? 10;

  for (const f of entryFiles) {
    if (visited.has(f)) continue;
    all.push(f);

    const ext = path.extname(f);
    if (!CODE_EXTS.includes(ext)) continue;

    const resolver = RESOLVERS[ext];
    if (resolver) {
      const result = await resolver(f, cfg, visited, 0, resolverDepth);
      const { files, stats } = result;
      all.push(...files);
      stats?.expected?.forEach(x => expected.add(x));
      stats?.resolved?.forEach(x => resolved.add(x));
    }

    if (limit && all.length >= limit) {
      console.log("⚠️  Limit reached:", limit);
      break;
    }
  }

  return {
    files: [...new Set(all)],
    stats: {
      expected,
      resolved
    }
  };
}

