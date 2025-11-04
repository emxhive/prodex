import fs from "fs";
import path from "path";
import { DEFAULT_PRODEX_CONFIG } from "../constants/default-config";

export async function initProdex() {
	console.log("🪄 Prodex Init — Configuration Wizard (v3");

	const dest = path.join(process.cwd(), "prodex.json");

	if (fs.existsSync(dest)) {
		console.error("prodex.json already exists. Delete or modify it manually.\n");
		return;
	}

	fs.writeFileSync(dest, JSON.stringify(DEFAULT_PRODEX_CONFIG, null, 2) + "\n", "utf8");
	console.log(`✅ Created ${dest}`);
	console.log("💡 Globs supported everywhere (include, exclude, priority).");
}
