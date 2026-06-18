import type { ExecutionPlan, CommandIntent, ProdexConfigFile, CommandAttachmentOptions } from "../../types";
import { normalizePathOrGlob } from "../../filesystem/path-patterns";
import { uniqueTrimmed } from "./list-utils";

export interface ScopePlanResult {
	plans: ExecutionPlan[];
	listScopes?: string[];
}

export function buildScopePlan(params: {
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
}): ScopePlanResult {
	const { intent, userConfig, root, aliases, depth, maxFiles, defaultOutput, attachmentOptions, warnings, errors } = params;
	const flags = intent.flags ?? {};

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
		return { plans: [] };
	}

	const hasKey = flags.key && flags.key.length > 0;
	const hasAll = !!flags.all;
	const hasList = !!flags.list;

	if (!hasKey && !hasAll && !hasList) {
		errors.push('Command "scope" requires specifying "-k/--key", "--all", or "--list".');
		return { plans: [] };
	}

	let selectedModesCount = 0;
	if (hasKey) selectedModesCount++;
	if (hasAll) selectedModesCount++;
	if (hasList) selectedModesCount++;

	if (selectedModesCount > 1) {
		errors.push('Command "scope" options "--key", "--all", and "--list" are mutually exclusive.');
		return { plans: [] };
	}

	const availableScopes = Object.keys(userConfig.scopes ?? {}).sort();

	if (hasList) {
		if ((flags.cmd && flags.cmd.length > 0) || flags.cmdTimeout !== undefined || flags.failOnCmdError !== undefined) {
			errors.push('Option "--list" cannot be used with command attachment options.');
			return { plans: [] };
		}
		return { plans: [], listScopes: availableScopes };
	}

	if (errors.length) {
		return { plans: [] };
	}

	let targetKeys: string[] = [];
	if (hasAll) {
		targetKeys = availableScopes;
		if (!targetKeys.length) {
			errors.push("No scopes are defined in prodex.json.");
			return { plans: [] };
		}
	} else if (flags.key) {
		for (const key of flags.key) {
			if (!userConfig.scopes?.[key]) {
				errors.push(`Unknown scope "${key}".`);
				return { plans: [] };
			}
			targetKeys.push(key);
		}
	}

	const plans: ExecutionPlan[] = [];
	for (const key of targetKeys) {
		const scope = userConfig.scopes![key];
		const scopeEntries = (scope.entry ?? []).map((item) => normalizePathOrGlob(item, root, { role: "entry" }));
		const scopeIncludes = (scope.include ?? []).map((item) => normalizePathOrGlob(item, root, { role: "include" }));
		const scopeExcludes = [...(userConfig.exclude ?? []), ...(scope.exclude ?? [])].map((item) => normalizePathOrGlob(item, root, { role: "exclude" }));

		plans.push({
			root,
			command: "scope",
			outputName: scope.name ?? key,
			entry: scopeEntries,
			include: scopeIncludes,
			exclude: uniqueTrimmed(scopeExcludes),
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
			attachmentOptions,
		});
	}

	return { plans };
}
