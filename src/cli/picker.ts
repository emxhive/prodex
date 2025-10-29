import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import { ROOT } from "../constants/config.js";
import { walk, rel, sortWithPriority } from "../core/helpers.js";

/**
 * Prodex v2 picker
 * - Keeps "Load more" (depth++)
 * - Removes manual path entry
 * - Uses cfg.entry.includes / cfg.entry.priority
 */
export async function pickEntries(baseDirs, depth = 2, cfg = {}) {
  let selected = [];

  while (true) {
    const files = [];

    // Use an effective cfg that reflects the current depth for this iteration
    const effectiveCfg = { ...cfg, scanDepth: depth };

    for (const base of baseDirs) {
      const full = path.join(ROOT, base);
      if (!fs.existsSync(full)) continue;
      for (const f of walk(full, effectiveCfg, 0)) files.push(f);
    }

    // Priority-aware ordering
    const sorted = sortWithPriority(files, cfg.entry?.priority || []);

    // Build choices + the "Load more" control
    const choices = sorted.map(f => ({ name: rel(f), value: f }));
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
        default: selected
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

  return [...new Set(selected)];
}
