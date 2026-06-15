import type { ProdexConfigFile, ProdexFlags, ExecutionPlan, CommandIntent, ProdexScope } from "../types";
import { DEFAULT_PRODEX_CONFIG } from "../config/default-config";
import { sanitizeFileName } from "../filesystem/path";

export interface PlannerResult {
	plans: ExecutionPlan[];
	warnings: string[];
	errors: string[];
	listScopes?: string[];
}

export function createExecutionPlans(params: {
	intent: CommandIntent;
	userConfig: ProdexConfigFile;
	root: string;
}): PlannerResult {
	const { intent, userConfig, root } = params;
	const warnings: string[] = [];
	const errors: string[] = [];

	const aliases = userConfig.aliases ?? DEFAULT_PRODEX_CONFIG.aliases;
	const depth = userConfig.depth ?? DEFAULT_PRODEX_CONFIG.depth;
	const maxFiles = userConfig.maxFiles ?? DEFAULT_PRODEX_CONFIG.maxFiles;
	const defaultOutput = {
		dir: userConfig.output?.dir ?? DEFAULT_PRODEX_CONFIG.output.dir,
		versioned: userConfig.output?.versioned ?? DEFAULT_PRODEX_CONFIG.output.versioned,
		format: userConfig.output?.format ?? DEFAULT_PRODEX_CONFIG.output.format,
	};

	const flags = intent.flags ?? {};

	if (intent.kind === "pack") {
		// Validation
		if (flags.key !== undefined || flags.all !== undefined || flags.list !== undefined) {
			errors.push('Command "pack" does not accept "--key", "--all", or "--list".');
			return { plans: [], warnings, errors };
		}

		const hasCliEntry = flags.entry && flags.entry.length > 0;
		const hasCliInclude = flags.include && flags.include.length > 0;
		const hasCliScope = flags.scope && flags.scope.length > 0;

		if (!hasCliEntry && !hasCliInclude && !hasCliScope) {
			errors.push('Command "pack" requires at least one source: --entry, --include, or --scope.');
			return { plans: [], warnings, errors };
		}

		const rootExclude = userConfig.exclude ?? [];
		const scopeEntries: string[] = [];
		const scopeIncludes: string[] = [];
		const scopeExcludes: string[] = [];

		if (flags.scope && flags.scope.length > 0) {
			for (const scopeKey of flags.scope) {
				const scope = userConfig.scopes?.[scopeKey];
				if (!scope) {
					errors.push(`Unknown scope "${scopeKey}".`);
					return { plans: [], warnings, errors };
				}
				if (scope.entry) scopeEntries.push(...scope.entry);
				if (scope.include) scopeIncludes.push(...scope.include);
				if (scope.exclude) scopeExcludes.push(...scope.exclude);
			}
		}

		const mergedEntry = [...scopeEntries, ...(flags.entry ?? [])];
		const mergedInclude = [...scopeIncludes, ...(flags.include ?? [])];
		const mergedExclude = [...rootExclude, ...scopeExcludes, ...(flags.exclude ?? [])];

		const plan: ExecutionPlan = {
			root,
			command: "pack",
			outputName: flags.name ?? "pack-combined",
			entry: unique(mergedEntry),
			include: unique(mergedInclude),
			exclude: unique(mergedExclude),
			depth: flags.depth ?? depth,
			maxFiles: flags.maxFiles ?? maxFiles,
			aliases,
			output: {
				dir: defaultOutput.dir,
				versioned: defaultOutput.versioned,
				format: flags.format ?? defaultOutput.format,
			},
			dryRun: !!flags.dryRun,
		};

		return { plans: [plan], warnings, errors };
	}

	if (intent.kind === "trace") {
		// Validation
		if (flags.include !== undefined) {
			errors.push('Command "trace" does not accept "--include" (or "-i").');
		}
		if (flags.scope !== undefined) {
			errors.push('Command "trace" does not accept "--scope" (or "-s").');
		}
		if (flags.key !== undefined || flags.all !== undefined || flags.list !== undefined) {
			errors.push('Command "trace" does not accept "--key", "--all", or "--list".');
		}
		if (!flags.entry || flags.entry.length === 0) {
			errors.push('Command "trace" requires --entry.');
		}

		if (errors.length) return { plans: [], warnings, errors };

		const mergedExclude = [...(userConfig.exclude ?? []), ...(flags.exclude ?? [])];

		const plan: ExecutionPlan = {
			root,
			command: "trace",
			outputName: flags.name,
			entry: unique(flags.entry ?? []),
			include: [],
			exclude: unique(mergedExclude),
			depth: flags.depth ?? depth,
			maxFiles: flags.maxFiles ?? maxFiles,
			aliases,
			output: {
				dir: defaultOutput.dir,
				versioned: defaultOutput.versioned,
				format: flags.format ?? defaultOutput.format,
			},
			dryRun: !!flags.dryRun,
		};

		return { plans: [plan], warnings, errors };
	}

	if (intent.kind === "scope") {
		// Validation
		if (
			flags.entry !== undefined ||
			flags.include !== undefined ||
			flags.exclude !== undefined ||
			flags.scope !== undefined ||
			flags.name !== undefined ||
			flags.depth !== undefined ||
			flags.maxFiles !== undefined
		) {
			errors.push('Command "scope" does not accept "--entry", "--include", "--exclude", "--scope", "--name", "--depth", or "--max-files".');
			return { plans: [], warnings, errors };
		}

		const hasKey = flags.key && flags.key.length > 0;
		const hasAll = !!flags.all;
		const hasList = !!flags.list;

		if (!hasKey && !hasAll && !hasList) {
			errors.push('Command "scope" requires specifying "-k/--key", "--all", or "--list".');
			return { plans: [], warnings, errors };
		}

		let selectedModesCount = 0;
		if (hasKey) selectedModesCount++;
		if (hasAll) selectedModesCount++;
		if (hasList) selectedModesCount++;

		if (selectedModesCount > 1) {
			errors.push('Command "scope" options "--key", "--all", and "--list" are mutually exclusive.');
			return { plans: [], warnings, errors };
		}

		const availableScopes = Object.keys(userConfig.scopes ?? {}).sort();

		if (hasList) {
			return { plans: [], warnings, errors, listScopes: availableScopes };
		}

		let targetKeys: string[] = [];
		if (hasAll) {
			targetKeys = availableScopes;
			if (!targetKeys.length) {
				errors.push("No scopes are defined in prodex.json.");
				return { plans: [], warnings, errors };
			}
		} else if (flags.key) {
			for (const key of flags.key) {
				if (!userConfig.scopes?.[key]) {
					errors.push(`Unknown scope "${key}".`);
					return { plans: [], warnings, errors };
				}
				targetKeys.push(key);
			}
		}

		const plans: ExecutionPlan[] = [];
		for (const key of targetKeys) {
			const scope = userConfig.scopes![key];
			plans.push({
				root,
				command: "scope",
				outputName: scope.name ?? key,
				entry: scope.entry ?? [],
				include: scope.include ?? [],
				exclude: unique([...(userConfig.exclude ?? []), ...(scope.exclude ?? [])]),
				depth,
				maxFiles,
				aliases,
				output: {
					dir: defaultOutput.dir,
					versioned: defaultOutput.versioned,
					format: flags.format ?? defaultOutput.format,
				},
				dryRun: !!flags.dryRun,
				scopeKey: key,
			});
		}

		return { plans, warnings, errors };
	}

	return { plans: [], warnings, errors };
}

function unique(items: string[]): string[] {
	return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
