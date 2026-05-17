import fs from "fs";
import path from "path";
import { DEFAULT_PRODEX_CONFIG } from "../constants";
import type { ProdexConfigFile } from "../types";
import { parseJsonFile } from "./json";

export const REQUIRED_CONFIG_VERSION = 4;

export interface MigrationPreview {
	needed: boolean;
	fromVersion?: number;
	toVersion: number;
	changes: string[];
	config?: ProdexConfigFile;
}

export interface MigrationCommandResult extends MigrationPreview {
	ok: boolean;
	written: boolean;
	backupPath?: string;
	path: string;
	warnings: string[];
	errors: string[];
}

export function isOutdatedConfig(config: any): boolean {
	return typeof config?.version === "number" && config.version < REQUIRED_CONFIG_VERSION;
}

export function requiresConfigMigration(config: any): boolean {
	return isOutdatedConfig(config) || looksLikeLegacyConfig(config);
}

export function configVersionError(version: unknown): string {
	const label = typeof version === "number" ? String(version) : "an older format";
	return [
		`prodex.json uses config version ${label}, but this Prodex version requires config version ${REQUIRED_CONFIG_VERSION}.`,
		"",
		"Prodex v4 changed the config shape:",
		"  entry.files -> entry",
		"  resolve.include -> include",
		"  resolve.exclude -> exclude",
		"  resolve.depth -> resolve.maxDepth",
		"  resolve.limit -> resolve.maxFiles",
		"  shortcuts -> profiles",
		"",
		"Preview migration:",
		"  prodex migrate",
		"",
		"Update prodex.json:",
		"  prodex migrate --write",
	].join("\n");
}

export function legacyConfigShapeError(): string {
	return [
		"prodex.json contains legacy config fields that must be migrated to config version 4.",
		"",
		"Prodex v4 changed the config shape:",
		"  entry.files -> entry",
		"  resolve.include -> include",
		"  resolve.exclude -> exclude",
		"  resolve.depth -> resolve.maxDepth",
		"  resolve.limit -> resolve.maxFiles",
		"  shortcuts -> profiles",
		"",
		"Preview migration:",
		"  prodex migrate",
		"",
		"Update prodex.json:",
		"  prodex migrate --write",
	].join("\n");
}

export function migrateConfig(input: any): MigrationPreview {
	if (!requiresConfigMigration(input)) {
		return {
			needed: false,
			fromVersion: typeof input?.version === "number" ? input.version : undefined,
			toVersion: REQUIRED_CONFIG_VERSION,
			changes: [],
			config: input as ProdexConfigFile,
		};
	}

	const changes: string[] = [];
	const output = {
		...DEFAULT_PRODEX_CONFIG.output,
		...(input.output ?? {}),
	};
	delete (output as any).prefix;
	if (input.output?.prefix !== undefined) changes.push("output.prefix removed; use --name or profile.name for output naming.");

	const resolve = {
		aliases: input.resolve?.aliases ?? DEFAULT_PRODEX_CONFIG.resolve.aliases,
		maxDepth: input.resolve?.maxDepth ?? input.resolve?.depth ?? DEFAULT_PRODEX_CONFIG.resolve.maxDepth,
		maxFiles: input.resolve?.maxFiles ?? input.resolve?.limit ?? DEFAULT_PRODEX_CONFIG.resolve.maxFiles,
	};

	const config: ProdexConfigFile = {
		version: REQUIRED_CONFIG_VERSION,
		$schema: input.$schema ?? DEFAULT_PRODEX_CONFIG.$schema,
		output,
		entry: normalizeStringArray(input.entry?.files ?? input.entry),
		include: normalizeStringArray(input.include ?? input.resolve?.include),
		exclude: normalizeStringArray(input.exclude ?? input.resolve?.exclude ?? DEFAULT_PRODEX_CONFIG.exclude),
		resolve,
		profiles: migrateProfiles(input.profiles ?? input.shortcuts ?? {}, changes),
	};

	if (input.entry?.files !== undefined) changes.push("entry.files -> entry");
	if (input.resolve?.include !== undefined) changes.push("resolve.include -> include");
	if (input.resolve?.exclude !== undefined) changes.push("resolve.exclude -> exclude");
	if (input.resolve?.depth !== undefined) changes.push("resolve.depth -> resolve.maxDepth");
	if (input.resolve?.limit !== undefined) changes.push("resolve.limit -> resolve.maxFiles");
	if (input.shortcuts !== undefined) changes.push("shortcuts -> profiles");

	return {
		needed: true,
		fromVersion: typeof input?.version === "number" ? input.version : undefined,
		toVersion: REQUIRED_CONFIG_VERSION,
		changes: unique(changes),
		config,
	};
}

export function runMigrationCommand(params: {
	rootArg?: string;
	cwd?: string;
	write?: boolean;
	check?: boolean;
}): MigrationCommandResult {
	const root = params.rootArg ? path.resolve(params.cwd ?? process.cwd(), params.rootArg) : params.cwd ?? process.cwd();
	const configPath = path.join(root, "prodex.json");
	const warnings: string[] = [];
	const errors: string[] = [];

	if (!fs.existsSync(root)) errors.push(`Invalid root path "${params.rootArg}".`);
	else if (!fs.statSync(root).isDirectory()) errors.push(`Root path "${params.rootArg}" is not a directory.`);
	if (errors.length) return emptyMigrationResult(configPath, warnings, errors);

	if (!fs.existsSync(configPath)) {
		errors.push("No prodex.json found.");
		return emptyMigrationResult(configPath, warnings, errors);
	}

	let raw: any;
	try {
		raw = parseJsonFile(fs.readFileSync(configPath, "utf8"));
	} catch (err: any) {
		errors.push(`Invalid prodex.json: ${err?.message || err}`);
		return emptyMigrationResult(configPath, warnings, errors);
	}

	const preview = migrateConfig(raw);
	if (params.check && preview.needed) {
		errors.push(`prodex.json requires migration to version ${REQUIRED_CONFIG_VERSION}.`);
	}
	if (params.check) {
		return { ...preview, ok: !preview.needed, written: false, path: configPath, warnings, errors };
	}
	if (!preview.needed || !params.write) {
		return { ...preview, ok: !errors.length, written: false, path: configPath, warnings, errors };
	}

	const backupPath = nextBackupPath(root, preview.fromVersion);
	fs.copyFileSync(configPath, backupPath);
	fs.writeFileSync(configPath, `${JSON.stringify(preview.config, null, 4)}\n`, "utf8");

	return {
		...preview,
		ok: true,
		written: true,
		backupPath,
		path: configPath,
		warnings,
		errors,
	};
}

function migrateProfiles(input: Record<string, any>, changes: string[]): ProdexConfigFile["profiles"] {
	const profiles: ProdexConfigFile["profiles"] = {};

	for (const [key, value] of Object.entries(input || {})) {
		profiles[key] = {
			...(value?.prefix ? { name: value.prefix } : {}),
			...(value?.name ? { name: value.name } : {}),
			...(value?.files || value?.entry ? { entry: normalizeStringArray(value.entry ?? value.files) } : {}),
			...(value?.include ? { include: normalizeStringArray(value.include) } : {}),
			...(value?.exclude ? { exclude: normalizeStringArray(value.exclude) } : {}),
		};

		if (value?.prefix !== undefined) changes.push("shortcuts.*.prefix -> profiles.*.name");
		if (value?.files !== undefined) changes.push("shortcuts.*.files -> profiles.*.entry");
	}

	return profiles;
}

function looksLikeLegacyConfig(config: any): boolean {
	return !!(
		config?.shortcuts ||
		config?.entry?.files ||
		config?.resolve?.include ||
		config?.resolve?.exclude ||
		config?.resolve?.depth ||
		config?.resolve?.limit ||
		config?.output?.prefix
	);
}

function normalizeStringArray(value: unknown): string[] {
	if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
	if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
	return [];
}

function nextBackupPath(root: string, version?: number): string {
	const suffix = version ? `v${String(version).replace(/\W+/g, "_")}` : "legacy";
	let backup = path.join(root, `prodex.${suffix}.backup.json`);
	let index = 1;
	while (fs.existsSync(backup)) {
		backup = path.join(root, `prodex.${suffix}.backup.${index}.json`);
		index++;
	}
	return backup;
}

function emptyMigrationResult(pathValue: string, warnings: string[], errors: string[]): MigrationCommandResult {
	return {
		ok: false,
		needed: false,
		toVersion: REQUIRED_CONFIG_VERSION,
		changes: [],
		written: false,
		path: pathValue,
		warnings,
		errors,
	};
}

function unique<T>(items: T[]): T[] {
	return [...new Set(items)];
}
