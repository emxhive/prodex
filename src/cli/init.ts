import fs from "fs";
import path from "path";
import { DEFAULT_PRODEX_CONFIG } from "../constants/default-config";
import { toJson } from "../lib/utils";

export async function initProdex() {
	console.log("🪄 Prodex Init — Configuration Wizard (v3");

	const dest = path.join(process.cwd(), "prodex.json");

	if (fs.existsSync(dest)) {
		console.error("prodex.json already exists. Delete or modify it manually.\n");
		return;
	}

	fs.writeFileSync(dest, toJson(DEFAULT_PRODEX_CONFIG) + "\n", "utf8");
	console.log(`✅ Created ${dest}`);
	console.log("💡 Globs supported everywhere (include, exclude, priority).");
}
