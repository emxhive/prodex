import fs from "fs";
import path from "path";
import { DEFAULT_PRODEX_CONFIG } from "./default-config";
import type { ProdexConfig, ProdexFlags } from "../types";
import { logger } from "../lib/logger";

/**
 * 🧩 Load and merge Prodex configuration (v3)
 *
 * 1️⃣ Reads `prodex.json` if present.
 * 2️⃣ Merges with `DEFAULT_PRODEX_CONFIG`.
 * 3️⃣ Normalizes all path-like fields.
 * 4️⃣ Applies CLI flag overrides.
 */
export async function loadProdexConfig(flags: Partial<ProdexFlags> = {}): Promise<ProdexConfig> {
	const cwd = process.cwd();
	const configPath = path.join(cwd, "prodex.json");
	let userConfig: Partial<ProdexConfig> = {};

	// 1️⃣ Load config if present
	if (fs.existsSync(configPath)) {
		try {
			const content = fs.readFileSync(configPath, "utf8");
			userConfig = JSON.parse(content);
			logger.verbose(`Loaded config from prodex.json`);
		} catch (err: any) {
			logger.error(`Failed to parse prodex.json: ${err.message}`);
		}
	} else {
		logger.info("No prodex.json found — using defaults.");
	}

	// 2️⃣ Merge defaults → user config
	const cfg: ProdexConfig = {
		...DEFAULT_PRODEX_CONFIG,
		...userConfig,
		output: {
			...DEFAULT_PRODEX_CONFIG.output,
			...userConfig.output,
		},
		entry: {
			...DEFAULT_PRODEX_CONFIG.entry,
			...userConfig.entry,
			ui: {
				...DEFAULT_PRODEX_CONFIG.entry.ui,
				...userConfig.entry?.ui,
			},
		},
		resolve: {
			...DEFAULT_PRODEX_CONFIG.resolve,
			...userConfig.resolve,
		},
		debug: {
			...DEFAULT_PRODEX_CONFIG.debug,
			...userConfig.debug,
		},
		root: cwd,
	};



	// 4️⃣ Apply CLI flag overrides (if any)
	applyFlagOverrides(cfg, flags);

	logger.debug("🧩 Final merged config →", JSON.stringify(cfg, null, 2));
	return cfg;
}

/** Merge CLI flags into config where relevant. */
function applyFlagOverrides(cfg: ProdexConfig, flags: Partial<ProdexFlags>): void {
	if (!flags) return;

	const { name, limit, inc, exc, txt, debug, verbose } = flags;

	if (name) cfg.output.prefix = String(name);
	if (txt) cfg.output.format = "txt";
	if (limit) cfg.resolve.limit = Number(limit);

	if (inc)
		cfg.resolve.includes = Array.isArray(inc)
			? inc
			: String(inc)
					.split(",")
					.map((s) => s.trim());

	if (exc)
		cfg.resolve.excludes = Array.isArray(exc)
			? exc
			: String(exc)
					.split(",")
					.map((s) => s.trim());

	// Enable runtime log modes via env
	if (debug) process.env.PRODEX_DEBUG = "1";
	if (verbose) process.env.PRODEX_VERBOSE = "1";

	logger.verbose("Applied CLI flag overrides.");
}
