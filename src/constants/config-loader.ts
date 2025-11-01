import fs from "fs";
import path from "path";
import { DEFAULT_PRODEX_CONFIG } from "./default-config";
import type { ProdexConfig, ProdexFlags } from "../types";
import { logger } from "../lib/logger";
import { normalizePatterns } from "../lib/utils";

/**
 * 🧩 Load and merge Prodex configuration (v3)
 *
 * 1️⃣ Reads `prodex.json` if present.
 * 2️⃣ Merges with `DEFAULT_PRODEX_CONFIG`.
 * 3️⃣ Normalizes all path-like fields.
 * 4️⃣ Applies CLI flag overrides.
 */
export async function loadProdexConfig(flags: Partial<ProdexFlags> = {}, cwd: string): Promise<ProdexConfig> {
	const configPath = path.join(cwd, "prodex.json");
	let userConfig: Partial<ProdexConfig> = {};

	// 1️⃣ Load config if present
	try {
		const content = fs.readFileSync(configPath, "utf8");
		userConfig = JSON.parse(content);
	} catch (err: any) {
		logger.info("No prodex.json found — using defaults.");
	}

	// 2️⃣ Merge defaults → user config
	const { output, entry, resolve } = DEFAULT_PRODEX_CONFIG;

	const cfg: ProdexConfig = {
		...DEFAULT_PRODEX_CONFIG,
		...userConfig,
		output: { ...output, ...userConfig.output },
		entry: {
			...entry,
			...userConfig.entry,
			ui: { ...entry.ui, ...userConfig.entry?.ui },
		},
		resolve: { ...resolve, ...userConfig.resolve },
		root: cwd,
		name: flags?.name,
	};

	// 4️⃣ Apply CLI flag overrides (if any)
	applyFlagOverrides(cfg, flags);
	tidyArrayFields(cfg);
	return cfg;
}

/** Merge CLI flags into config where relevant. */
/** Merge CLI flags into config where relevant. */
function applyFlagOverrides(cfg: ProdexConfig, flags: Partial<ProdexFlags>): void {
	if (!flags) return;

	const outputOverrides = {
		txt: (cfg: ProdexConfig, v) => (cfg.output.format = v ? "txt" : "md"),
	};

	const resolveOverrides = {
		limit: (cfg: ProdexConfig, v: any) => (cfg.resolve.limit = v),
		include: (cfg: ProdexConfig, v: any) => (cfg.resolve.include = v),
		exclude: (cfg: ProdexConfig, v: any) => (cfg.resolve.exclude = v),
	};

	const entryOverrides = {
		files: (cfg: ProdexConfig, v: any) => (cfg.entry.files = v),
	};

	const envOverrides = {
		debug: (_, v) => (process.env.PRODEX_DEBUG = v ? "1" : "0"),
		verbose: (_, v) => (process.env.PRODEX_VERBOSE = v ? "1" : "0"),
	};

	const overrideMap = {
		...outputOverrides,
		...resolveOverrides,
		...entryOverrides,
		...envOverrides,
	};

	// Apply all flag overrides dynamically
	for (const [flag, value] of Object.entries(flags)) {
		if (value == undefined) continue;
		const apply = overrideMap[flag];
		if (apply) apply(cfg, value);
	}

	// Conditional override rule:
	// If files exist and include was null/undefined → clear include array
	const hasFiles = Array.isArray(flags.files) ? flags.files.length > 0 : !!flags.files;

	if (hasFiles && !flags.include) {
		cfg.resolve.include = [];
	}
}

function tidyArrayFields(cfg: ProdexConfig) {
	cfg.entry.files = normalizePatterns(cfg.entry.files);
	["include", "exclude"].forEach((k) => (cfg.resolve[k] = cfg.resolve[k]));
}
