import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import { ROOT } from "../constants/config";
import { walk, rel, orderByPriority } from "../core/helpers";
import { globScan } from "../core/file-utils";
import { unique } from "../lib/utils";
import { logger } from "../lib/logger";



export async function pickEntries(baseDirs, depth = 2, cfg) {
  const entryPatterns = cfg.entry?.files || [];

  const priorities = [...entryPatterns, ...(cfg.entry?.priority || [])];
  const verbose = !!cfg.verbose;

  // 1) Resolve patterns to absolute files and preselect them
  const resolvedEntries = (await globScan(entryPatterns,{cwd : ROOT})).files;


  let selected = [...resolvedEntries];

  // cache: depth -> files[]
  const scanCache = new Map();

  for (; ;) {
    const files = await getFilesAtDepth({
      baseDirs,
      depth,
      cfg,
      scanCache,
      verbose,
    });

    // Merge resolved entries with current scan results
    const combined = unique([...resolvedEntries, ...files]);
    // Priority-aware ordering: entries first, then other priorities
    const sorted = orderByPriority(combined, priorities);

    // Build UI selection list
    const choices = sorted.map(f => ({
      name: path.relative(ROOT, f).norm(),
      value: f,
      checked: selected.includes(f),
    }));

    choices.push(new inquirer.Separator());
    choices.push({ name: "🔽 Load more (go deeper)", value: "__loadmore" });

    const { picks } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "picks",
        message: `Select entry files (depth ${depth})`,
        choices,
        loop: false,
        pageSize: 20,
      }
    ]);

    if (picks.includes("__loadmore")) {
      depth++;
      selected = picks.filter(p => p !== "__loadmore");
      continue;
    }

    selected = picks.filter(p => p !== "__loadmore");
    break;
  }

  return unique(selected);
}


async function getFilesAtDepth({ baseDirs, depth, cfg, scanCache, verbose }) {
  if (scanCache.has(depth)) {
    logger.verbose(`[cache] depth=${depth} ✓`);
    return scanCache.get(depth);
  }
  logger.verbose(`[scan]  depth=${depth} …`);

  const files = [];
  const effectiveCfg = { ...cfg, scanDepth: depth };

  for (const base of baseDirs) {
    const full = path.join(ROOT, base);
    if (!fs.existsSync(full)) continue;
    for (const f of walk(full, effectiveCfg, 0)) files.push(f.norm());
  }

  scanCache.set(depth, files);
  logger.verbose(`[scan]  depth=${depth} found=${files.length}`);
  return files;
}


