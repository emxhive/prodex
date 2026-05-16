import path from "path";
import { DEFAULT_PRODEX_CONFIG } from "../constants";
import type { DeepPartial, ProdexConfig, ProdexConfigFile, ProdexFlags, ProdexShortcut } from "../types";
import { normalizePath, sanitizeFileName } from "../platform/path";

export interface ConfigBuildResult {
	config?: ProdexConfig;
	warnings: string[];
	errors: string[];
}

export function buildConfig(params: {
	root: string;
	userConfig: ProdexConfigFile;
	flags?: Partial<ProdexFlags>;
	shortcutName?: string;
}): ConfigBuildResult {
	const warnings: string[] = [];
	const errors: string[] = [];
	const base = deepMerge(DEFAULT_PRODEX_CONFIG, params.userConfig || {});
	const shortcut = params.shortcutName ? base.shortcuts?.[params.shortcutName] : undefined;

	if (params.shortcutName && !shortcut) {
		errors.push(`Unknown shortcut "${params.shortcutName}".`);
		return { warnings, errors };
	}

	const layered = applyShortcutLayer(base, shortcut);
	const config = toRuntimeConfig(layered, params.root, params.flags, shortcut);
	normalizeRuntimeConfig(config, warnings);
	validateRuntimeConfig(config, errors);

	return { config, warnings, errors };
}

function applyShortcutLayer(config: ProdexConfigFile, shortcut?: ProdexShortcut): ProdexConfigFile {
	if (!shortcut) return config;

	const patch: DeepPartial<ProdexConfigFile> = {};
	if (shortcut.files) patch.entry = { files: shortcut.files };
	if (shortcut.include || shortcut.exclude) {
		patch.resolve = {};
		if (shortcut.include) patch.resolve.include = shortcut.include;
		if (shortcut.exclude) patch.resolve.exclude = shortcut.exclude;
	}
	if (shortcut.prefix) patch.output = { prefix: shortcut.prefix };

	return deepMerge(config, patch);
}

function toRuntimeConfig(
	fileConfig: ProdexConfigFile,
	root: string,
	flags?: Partial<ProdexFlags>,
	shortcut?: ProdexShortcut,
): ProdexConfig {
	const output = {
		...DEFAULT_PRODEX_CONFIG.output,
		...fileConfig.output,
	};
	const entry = {
		...DEFAULT_PRODEX_CONFIG.entry,
		...fileConfig.entry,
	};
	const resolve = {
		...DEFAULT_PRODEX_CONFIG.resolve,
		...fileConfig.resolve,
	};

	const cfg = {
		...fileConfig,
		output,
		entry,
		resolve,
		shortcuts: fileConfig.shortcuts ?? {},
		root,
		name: flags?.name ?? shortcut?.prefix ?? output.prefix,
	} as ProdexConfig;

	applyExplicitFlags(cfg, flags);
	return cfg;
}

function applyExplicitFlags(cfg: ProdexConfig, flags?: Partial<ProdexFlags>): void {
	if (!flags) return;
	if (flags.txt !== undefined) cfg.output.format = flags.txt ? "txt" : "md";
	if (flags.name !== undefined && flags.name !== null) cfg.name = sanitizeFileName(flags.name, cfg.output.prefix);
	if (flags.limit !== undefined && flags.limit !== null) cfg.resolve.limit = flags.limit;
	if (flags.files !== undefined) cfg.entry.files = flags.files;
	if (flags.include !== undefined) cfg.resolve.include = flags.include;
	if (flags.exclude !== undefined) cfg.resolve.exclude = flags.exclude;
}

function normalizeRuntimeConfig(cfg: ProdexConfig, warnings: string[]): void {
	cfg.root = path.resolve(cfg.root);
	cfg.output.dir = normalizePath(String(cfg.output.dir || "prodex"));
	cfg.output.prefix = sanitizeFileName(String(cfg.output.prefix || "combined"));
	cfg.name = sanitizeFileName(String(cfg.name || cfg.output.prefix));
	cfg.entry.files = normalizePatterns(cfg.entry.files, warnings, "entry.files");
	cfg.resolve.include = normalizePatterns(cfg.resolve.include, warnings, "resolve.include");
	cfg.resolve.exclude = normalizePatterns(cfg.resolve.exclude, warnings, "resolve.exclude");
	cfg.resolve.aliases = cfg.resolve.aliases ?? {};
	cfg.shortcuts = cfg.shortcuts ?? {};
}

function normalizePatterns(value: unknown, warnings: string[], field: string): string[] {
	const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
	const normalized: string[] = [];

	for (const item of raw) {
		const text = typeof item === "string" ? normalizePath(item.trim()) : "";
		if (!text) continue;
		normalized.push(text);
	}

	if (!Array.isArray(value) && value !== undefined && typeof value !== "string") {
		warnings.push(`${field} should be a string array; ignoring invalid value.`);
	}

	return normalized;
}

function validateRuntimeConfig(cfg: ProdexConfig, errors: string[]): void {
	if (!["md", "txt"].includes(cfg.output.format)) {
		errors.push(`output.format must be "md" or "txt".`);
	}
	if (!Number.isFinite(cfg.resolve.depth) || cfg.resolve.depth < 0) {
		errors.push("resolve.depth must be a non-negative number.");
	}
	if (!Number.isFinite(cfg.resolve.limit) || cfg.resolve.limit < 0) {
		errors.push("resolve.limit must be a non-negative number.");
	}
}

export function deepMerge<T extends Record<string, any>>(base: T, patch: DeepPartial<T>): T {
	const out: any = Array.isArray(base) ? [...base] : { ...base };

	for (const [key, value] of Object.entries(patch || {})) {
		if (value === undefined) continue;
		const current = (base as any)[key];
		if (Array.isArray(value)) out[key] = [...value];
		else if (isPlainObject(value) && isPlainObject(current)) out[key] = deepMerge(current, value as any);
		else out[key] = value;
	}

	return out;
}

function isPlainObject(value: unknown): value is Record<string, any> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
