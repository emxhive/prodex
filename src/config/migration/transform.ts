import { DEFAULT_PRODEX_CONFIG } from "../default-config";
import type { ProdexConfigFile } from "../../types";
import { REQUIRED_CONFIG_VERSION, requiresConfigMigration } from "./detect";
import type { MigrationPreview } from "./types";
import { toStringList } from "../string-list";

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
		entry: toStringList(input.entry?.files ?? input.entry),
		include: toStringList(input.include ?? input.resolve?.include),
		exclude: toStringList(input.exclude ?? input.resolve?.exclude ?? DEFAULT_PRODEX_CONFIG.exclude),
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

function migrateProfiles(input: Record<string, any>, changes: string[]): ProdexConfigFile["profiles"] {
	const profiles: ProdexConfigFile["profiles"] = {};

	for (const [key, value] of Object.entries(input || {})) {
		profiles[key] = {
			...(value?.prefix ? { name: value.prefix } : {}),
			...(value?.name ? { name: value.name } : {}),
			...(value?.files || value?.entry ? { entry: toStringList(value.entry ?? value.files) } : {}),
			...(value?.include ? { include: toStringList(value.include) } : {}),
			...(value?.exclude ? { exclude: toStringList(value.exclude) } : {}),
		};

		if (value?.prefix !== undefined) changes.push("shortcuts.*.prefix -> profiles.*.name");
		if (value?.files !== undefined) changes.push("shortcuts.*.files -> profiles.*.entry");
	}

	return profiles;
}

function unique<T>(items: T[]): T[] {
	return [...new Set(items)];
}
