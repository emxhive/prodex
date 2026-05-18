import path from "path";
import { DEFAULT_PRODEX_CONFIG } from "./default-config";
import type { DeepPartial, ProdexConfig, ProdexConfigFile, ProdexFlags, ProdexProfile } from "../types";
import { normalizePath, sanitizeFileName } from "../filesystem/path";
import { toStringList } from "./string-list";

export interface ConfigBuildResult {
	config?: ProdexConfig;
	warnings: string[];
	errors: string[];
}

export function buildConfig(params: {
	root: string;
	userConfig: ProdexConfigFile;
	flags?: Partial<ProdexFlags>;
	profileName?: string;
}): ConfigBuildResult {
	const warnings: string[] = [];
	const errors: string[] = [];
	const base = deepMerge(DEFAULT_PRODEX_CONFIG, params.userConfig || {});
	const profile = params.profileName ? base.profiles?.[params.profileName] : undefined;

	if (params.profileName && !profile) {
		errors.push(`Unknown profile "${params.profileName}".`);
		return { warnings, errors };
	}

	const layered = applyProfileLayer(base, profile);
	const config = toRuntimeConfig(layered, params.root, params.flags, profile);
	normalizeRuntimeConfig(config, warnings);
	validateRuntimeConfig(config, errors);

	return { config, warnings, errors };
}

function applyProfileLayer(config: ProdexConfigFile, profile?: ProdexProfile): ProdexConfigFile {
	if (!profile) return config;

	const patch: DeepPartial<ProdexConfigFile> = {};
	if (profile.entry) patch.entry = profile.entry;
	if (profile.include) patch.include = profile.include;
	if (profile.exclude) patch.exclude = profile.exclude;

	return deepMerge(config, patch);
}

function toRuntimeConfig(
	fileConfig: ProdexConfigFile,
	root: string,
	flags?: Partial<ProdexFlags>,
	profile?: ProdexProfile,
): ProdexConfig {
	const output = {
		...DEFAULT_PRODEX_CONFIG.output,
		...fileConfig.output,
	};
	const resolve = {
		...DEFAULT_PRODEX_CONFIG.resolve,
		...fileConfig.resolve,
	};

	const cfg = {
		...fileConfig,
		output,
		resolve,
		entry: fileConfig.entry ?? [],
		include: fileConfig.include ?? [],
		exclude: fileConfig.exclude ?? [],
		profiles: fileConfig.profiles ?? {},
		root,
		name: flags?.name ?? profile?.name,
	} as ProdexConfig;

	applyExplicitFlags(cfg, flags);
	return cfg;
}

function applyExplicitFlags(cfg: ProdexConfig, flags?: Partial<ProdexFlags>): void {
	if (!flags) return;
	if (flags.format !== undefined) cfg.output.format = flags.format;
	if (flags.name !== undefined && flags.name !== null) cfg.name = sanitizeFileName(flags.name);
	if (flags.maxDepth !== undefined && flags.maxDepth !== null) cfg.resolve.maxDepth = flags.maxDepth;
	if (flags.maxFiles !== undefined && flags.maxFiles !== null) cfg.resolve.maxFiles = flags.maxFiles;
	if (flags.entry !== undefined) cfg.entry = flags.entry;
	if (flags.include !== undefined) cfg.include = flags.include;
	if (flags.exclude !== undefined) cfg.exclude = flags.exclude;
}

function normalizeRuntimeConfig(cfg: ProdexConfig, warnings: string[]): void {
	cfg.root = path.resolve(cfg.root);
	cfg.output.dir = normalizePath(String(cfg.output.dir || "prodex"));
	cfg.name = cfg.name ? sanitizeFileName(String(cfg.name)) : undefined;
	cfg.entry = normalizePatterns(cfg.entry, warnings, "entry");
	cfg.include = normalizePatterns(cfg.include, warnings, "include");
	cfg.exclude = normalizePatterns(cfg.exclude, warnings, "exclude");
	cfg.resolve.aliases = cfg.resolve.aliases ?? {};
	cfg.profiles = cfg.profiles ?? {};
}

function normalizePatterns(value: unknown, warnings: string[], field: string): string[] {
	const normalized: string[] = [];

	for (const item of toStringList(value)) normalized.push(normalizePath(item));

	if (!Array.isArray(value) && value !== undefined && typeof value !== "string") {
		warnings.push(`${field} should be a string array; ignoring invalid value.`);
	}

	return normalized;
}

function validateRuntimeConfig(cfg: ProdexConfig, errors: string[]): void {
	if (!["md", "txt"].includes(cfg.output.format)) {
		errors.push(`output.format must be "md" or "txt".`);
	}
	if (!Number.isFinite(cfg.resolve.maxDepth) || cfg.resolve.maxDepth < 0) {
		errors.push("resolve.maxDepth must be a non-negative number.");
	}
	if (!Number.isFinite(cfg.resolve.maxFiles) || cfg.resolve.maxFiles < 0) {
		errors.push("resolve.maxFiles must be a non-negative number.");
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
