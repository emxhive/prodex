import fs from "fs";
import path from "path";
import { DEFAULT_PRODEX_CONFIG } from "../constants/default-config.js";

export async function initProdex() {
  console.log("🪄 Prodex Init — Configuration Wizard (v2)\n");

  const dest = path.join(process.cwd(), "prodex.json");

  if (fs.existsSync(dest)) {
    console.log("❌ prodex.json already exists. Delete or modify it manually.\n");
    return;
  }

  fs.writeFileSync(dest, JSON.stringify(DEFAULT_PRODEX_CONFIG, null, 2) + "\n", "utf8");
  console.log(`✅ Created ${dest}`);
  console.log("💡 Globs supported everywhere (includes, excludes, priority).");
}
