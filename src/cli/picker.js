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
