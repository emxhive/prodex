import type { ExecutionPlan, CommandIntent, ProdexConfigFile, CommandAttachmentOptions } from "../../types";

export function buildPackPlan(params: {
	intent: CommandIntent;
	userConfig: ProdexConfigFile;
	root: string;
	aliases: Record<string, string>;
	depth: number;
	maxFiles: number;
	defaultOutput: ExecutionPlan["output"];
	attachmentOptions: CommandAttachmentOptions | undefined;
	warnings: string[];
	errors: string[];
}): ExecutionPlan[] {
	const { intent, userConfig, root, aliases, depth, maxFiles, defaultOutput, attachmentOptions, warnings, errors } = params;
	const flags = intent.flags ?? {};

	// Validation
	if (flags.key !== undefined || flags.all !== undefined || flags.list !== undefined) {
		errors.push('Command "pack" does not accept "--key", "--all", or "--list".');
		return [];
	}

	const hasCliEntry = flags.entry && flags.entry.length > 0;
	const hasCliInclude = flags.include && flags.include.length > 0;
	const hasCliScope = flags.scope && flags.scope.length > 0;

	if (!hasCliEntry && !hasCliInclude && !hasCliScope) {
		errors.push('Command "pack" requires at least one source: --entry, --include, or --scope.');
		return [];
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
				return [];
			}
			if (scope.entry) scopeEntries.push(...scope.entry);
			if (scope.include) scopeIncludes.push(...scope.include);
			if (scope.exclude) scopeExcludes.push(...scope.exclude);
		}
	}

	const mergedEntry = [...scopeEntries, ...(flags.entry ?? [])];
	const mergedInclude = [...scopeIncludes, ...(flags.include ?? [])];
	const mergedExclude = [...rootExclude, ...scopeExcludes, ...(flags.exclude ?? [])];

	if (errors.length) {
		return [];
	}

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
		attachmentOptions,
	};

	return [plan];
}

function unique(items: string[]): string[] {
	return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
