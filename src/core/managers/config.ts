import fs from "fs";
import path from "path";
import { DEFAULT_PRODEX_CONFIG } from "../../constants/default-config";
import { ArrisEmpty, normalizePatterns, toJson } from "../../lib/utils";
import { FLAG_MAP } from "../../constants/flags";
import type { ProdexConfig, ProdexFlags, ProdexConfigFile, DeepPartial, ProdexShortcut } from "../../types";
import { getConfig } from "../../store";

/**
 * 🧩 ConfigManager
 * Unified loader, merger, and flag applier.
 */
export class ConfigManager {
	static rawFile: ProdexConfigFile | null = null;

	static load(cwd: string = process.cwd()): ProdexConfigFile {
		const file = path.join(cwd, "prodex.json");
		if (!fs.existsSync(file)) return DEFAULT_PRODEX_CONFIG;
		try {
			const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
			this.rawFile = parsed; // <-- SAVE RAW COPY
			return parsed;
		} catch {
			console.warn("⚠️ Invalid prodex.json — using defaults.");
			return DEFAULT_PRODEX_CONFIG;
		}
	}

	static merge(user: ProdexConfigFile, flags?: Partial<ProdexFlags>, cwd = process.cwd()): ProdexConfig {
		const merged: ProdexConfig = {
			// ...rest,
			...user,
			output: { ...DEFAULT_PRODEX_CONFIG.output, ...user.output },
			entry: {
				...DEFAULT_PRODEX_CONFIG.entry,
				...user.entry,
				ui: { ...DEFAULT_PRODEX_CONFIG.entry.ui, ...user.entry?.ui },
			},
			resolve: { ...DEFAULT_PRODEX_CONFIG.resolve, ...user.resolve },
			root: cwd,
			name: flags?.name ?? null,
		} as unknown as ProdexConfig;

		this.applyFlags(merged, flags);
		return this.normalize(merged);
	}

	static applyFlags(cfg: ProdexConfig, flags?: Partial<ProdexFlags>) {
		if (!flags) return cfg;

		for (const [key, val] of Object.entries(flags)) {
			if (val === undefined) continue;
			const def = FLAG_MAP[key];
			if (def?.apply) def.apply(cfg, val);
		}

		const hasFiles = Array.isArray(flags.files) ? flags.files.length > 0 : !!flags.files;
		const hasInclude = Array.isArray(flags.include) ? flags.include.length > 0 : !!flags.include;

		if (hasInclude && !hasFiles) cfg.entry.files = [];

		if (hasFiles && !hasInclude) cfg.resolve.include = [];

		if (flags.shortcut && cfg.shortcuts && cfg.shortcuts[flags.shortcut]) return this.applyShortcuts(cfg, flags);


		return cfg;
	}

	static applyShortcuts(cfg: ProdexConfig, flags: Partial<ProdexFlags>): ProdexConfig {
		const shortcut = cfg.shortcuts?.[flags.shortcut];
		if (!shortcut) return cfg;

		const mergeOrReplace = (key: keyof ProdexFlags, target: any) => {
			const flagValues = (flags[key] || []) as unknown as any[];
			const hasFlags = !ArrisEmpty(flagValues);
			let values = shortcut[key];

			if (!values && !hasFlags) {
				target[key] = [];
				return;
			}
			if (!values) values = [];
			target[key] = hasFlags ? [...flagValues, ...values] : values;
		};

		// include / exclude live in cfg.resolve
		mergeOrReplace("include", cfg.resolve);
		mergeOrReplace("exclude", cfg.resolve);

		// files live in cfg.entry
		mergeOrReplace("files", cfg.entry);

		// name override
		if (shortcut.prefix) cfg.name = shortcut.prefix;

		return cfg;
	}

	static normalize(cfg: ProdexConfig): ProdexConfig {
		cfg.entry.files = normalizePatterns(cfg.entry.files);
		//TODO: Is there a need?
		// cfg.resolve.include = normalizePatterns(cfg.resolve.include);
		// cfg.resolve.exclude = normalizePatterns(cfg.resolve.exclude);
		return cfg;
	}

	static persist(partial: DeepPartial<ProdexConfigFile>): void {
		const cfg = getConfig();
		const dest = path.join(cfg.root, "prodex.json");

		// Start from the raw config, never the merged runtime version
		const base: ProdexConfigFile = ConfigManager.rawFile
			? JSON.parse(JSON.stringify(ConfigManager.rawFile)) // deep clone to avoid mutation
			: {};

		// Apply only the partial updates (aliases, etc.)
		const patched = deepMerge(base, partial);

		try {
			fs.writeFileSync(dest, toJson(patched) + "\n", "utf8");
		} catch (err: any) {
			console.warn("⚠️ Failed to persist config:", err?.message || err);
		}
	}
}

function deepMerge<T extends Record<string, any>>(base: T, patch: DeepPartial<T>): T {
	if (!patch) return base;
	const out: any = Array.isArray(base) ? [...base] : { ...base };
	for (const [k, v] of Object.entries(patch)) {
		if (v === undefined) continue;
		const bv = (base as any)[k];
		if (Array.isArray(v)) out[k] = [...v]; // overwrite arrays
		else if (isPlainObject(v) && isPlainObject(bv)) out[k] = deepMerge(bv, v);
		else out[k] = v;
	}
	return out;
}
function isPlainObject(x: any): x is Record<string, any> {
	return x && typeof x === "object" && !Array.isArray(x);
}
