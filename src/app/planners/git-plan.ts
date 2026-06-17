import type { ExecutionPlan, CommandIntent, ProdexConfigFile, CommandAttachmentOptions } from "../../types";
import { normalizePathOrGlob } from "../../filesystem/path-patterns";

export function buildGitPlan(params: {
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

	if (
		flags.entry !== undefined ||
		flags.scope !== undefined ||
		flags.key !== undefined ||
		flags.all !== undefined ||
		flags.list !== undefined ||
		flags.depth !== undefined ||
		flags.maxFiles !== undefined
	) {
		errors.push('Command "git" does not accept "--entry", "--scope", "--key", "--all", "--list", "--depth", or "--max-files".');
		return [];
	}

	const rootExclude = userConfig.exclude ?? [];
	const mergedInclude = (flags.include ?? []).map((item) => normalizePathOrGlob(item, root, { role: "include" }));
	const mergedExclude = [...rootExclude, ...(flags.exclude ?? [])].map((item) => normalizePathOrGlob(item, root, { role: "exclude" }));

	const gitOptions = {
		changed: !!flags.changed,
		staged: !!flags.staged,
		unstaged: !!flags.unstaged,
		untracked: !!flags.untracked,
		includeDiff: !!flags.includeDiff,
	};

	if (!gitOptions.changed && !gitOptions.staged && !gitOptions.unstaged && !gitOptions.untracked) {
		gitOptions.changed = true;
	}

	if (gitOptions.changed) {
		gitOptions.staged = true;
		gitOptions.unstaged = true;
		gitOptions.untracked = true;
	}

	const plan: ExecutionPlan = {
		root,
		command: "git",
		outputName: flags.name ?? "git-changes",
		entry: [],
		include: unique(mergedInclude),
		exclude: unique(mergedExclude),
		depth,
		maxFiles,
		aliases,
		output: {
			dir: defaultOutput.dir,
			versioned: defaultOutput.versioned,
			format: flags.format ?? defaultOutput.format,
		},
		dryRun: !!flags.dryRun,
		attachmentOptions,
		gitOptions,
	};

	return [plan];
}

function unique(items: string[]): string[] {
	return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
