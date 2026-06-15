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
	if (input.output?.prefix !== undefined) {
		changes.push("output.prefix removed; use scope.name when you need to override scope output names.");
	}

	const aliases = input.aliases ?? input.resolve?.aliases ?? DEFAULT_PRODEX_CONFIG.aliases;
	if (input.resolve?.aliases !== undefined) changes.push("resolve.aliases -> aliases");

	const depth = input.depth ?? input.resolve?.maxDepth ?? input.resolve?.depth ?? DEFAULT_PRODEX_CONFIG.depth;
	if (input.resolve?.maxDepth !== undefined || input.resolve?.depth !== undefined) changes.push("resolve.maxDepth -> depth");

	const maxFiles = input.maxFiles ?? input.resolve?.maxFiles ?? input.resolve?.limit ?? DEFAULT_PRODEX_CONFIG.maxFiles;
	if (input.resolve?.maxFiles !== undefined || input.resolve?.limit !== undefined) changes.push("resolve.maxFiles -> maxFiles");

	const exclude = toStringList(input.exclude ?? input.resolve?.exclude ?? DEFAULT_PRODEX_CONFIG.exclude);
	if (input.resolve?.exclude !== undefined) changes.push("resolve.exclude -> exclude");

	if (input.profiles !== undefined) {
		changes.push("profiles -> scopes");
		let hasProfileName = false;
		for (const key of Object.keys(input.profiles)) {
			if (input.profiles[key]?.name !== undefined) {
				hasProfileName = true;
				break;
			}
		}
		if (hasProfileName) {
			changes.push("profiles.*.name -> scopes.*.name");
		}
	}
	if (input.shortcuts !== undefined) changes.push("shortcuts -> scopes");

	const scopes = migrateScopes(input.scopes ?? input.profiles ?? input.shortcuts ?? {}, changes);

	const entryList = input.entry !== undefined ? toStringList(input.entry?.files ?? input.entry) : [];
	const includeList = (input.include !== undefined || input.resolve?.include !== undefined) 
		? toStringList(input.include ?? input.resolve?.include) 
		: [];

	const hasRootEntry = entryList.length > 0;
	const hasRootInclude = includeList.length > 0;

	if (hasRootEntry || hasRootInclude) {
		if (!scopes.default) {
			scopes.default = {};
		}
		const defScope = scopes.default;

		if (hasRootEntry) {
			const existingEntry = defScope.entry ?? [];
			defScope.entry = unique([...existingEntry, ...entryList]);
			changes.push("entry -> scopes.default.entry");
		}
		if (hasRootInclude) {
			const existingInclude = defScope.include ?? [];
			defScope.include = unique([...existingInclude, ...includeList]);
			changes.push("include -> scopes.default.include");
		}

		if (input.output?.prefix !== undefined && defScope.name === undefined) {
			defScope.name = input.output.prefix;
		}
	} else {
		if (input.entry !== undefined) {
			changes.push("entry -> scopes.default.entry");
		}
		if (input.include !== undefined || input.resolve?.include !== undefined) {
			changes.push("include -> scopes.default.include");
		}
	}

	const config: any = {
		version: REQUIRED_CONFIG_VERSION,
		$schema: input.$schema ?? DEFAULT_PRODEX_CONFIG.$schema,
		output,
		exclude,
		aliases,
		depth,
		maxFiles,
		scopes,
	};

	return {
		needed: true,
		fromVersion: typeof input?.version === "number" ? input.version : undefined,
		toVersion: REQUIRED_CONFIG_VERSION,
		changes: unique(changes),
		config,
	};
}

function migrateScopes(input: Record<string, any>, changes: string[]): any {
	const scopes: any = {};

	for (const [key, value] of Object.entries(input || {})) {
		scopes[key] = {
			...(value?.prefix ? { name: value.prefix } : {}),
			...(value?.name ? { name: value.name } : {}),
			...(value?.files || value?.entry ? { entry: toStringList(value.entry ?? value.files) } : {}),
			...(value?.include ? { include: toStringList(value.include) } : {}),
			...(value?.exclude ? { exclude: toStringList(value.exclude) } : {}),
		};

		if (value?.prefix !== undefined) changes.push("shortcuts.*.prefix -> scopes.*.name");
		if (value?.files !== undefined) changes.push("shortcuts.*.files -> scopes.*.entry");
	}

	return scopes;
}

function unique<T>(items: T[]): T[] {
	return [...new Set(items)];
}
