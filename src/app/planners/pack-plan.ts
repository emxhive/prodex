import type { ExecutionPlan, CommandIntent, ProdexConfigFile, CommandAttachmentOptions } from "../../types";
import { normalizePathOrGlob } from "../../filesystem/path-patterns";
import { uniqueTrimmed } from "./list-utils";

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
	const hasCollectionSource = !!hasCliEntry || !!hasCliInclude || !!hasCliScope;
	const hasValidCommandAttachment = !errors.length && (attachmentOptions?.commands.length ?? 0) > 0;
	const allowEmptyCollection = !hasCollectionSource && hasValidCommandAttachment;

	if (!hasCollectionSource && !hasValidCommandAttachment) {
		errors.push('Command "pack" requires at least one source or command: --entry, --include, --scope, or --cmd.');
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

	const mergedEntry = [...scopeEntries, ...(flags.entry ?? [])].map((item) => normalizePathOrGlob(item, root, { role: "entry" }));
	const mergedInclude = [...scopeIncludes, ...(flags.include ?? [])].map((item) => normalizePathOrGlob(item, root, { role: "include" }));
	const mergedExclude = [...rootExclude, ...scopeExcludes, ...(flags.exclude ?? [])].map((item) => normalizePathOrGlob(item, root, { role: "exclude" }));

	if (errors.length) {
		return [];
	}

	const plan: ExecutionPlan = {
		root,
		command: "pack",
		outputName: flags.name ?? "pack-combined",
		entry: uniqueTrimmed(mergedEntry),
		include: uniqueTrimmed(mergedInclude),
		exclude: uniqueTrimmed(mergedExclude),
		depth: flags.depth ?? depth,
		maxFiles: flags.maxFiles ?? maxFiles,
		aliases,
		output: {
			dir: defaultOutput.dir,
			versioned: defaultOutput.versioned,
			format: flags.format ?? defaultOutput.format,
		},
		dryRun: !!flags.dryRun,
		allowEmptyCollection,
		copy: !!flags.copy,
		attachmentOptions,
	};

	return [plan];
}
