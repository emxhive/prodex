import type { ExecutionPlan, CommandIntent, ProdexConfigFile, CommandAttachmentOptions } from "../../types";
import { normalizePathOrGlob } from "../../filesystem/path-patterns";
import { uniqueTrimmed } from "./list-utils";

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

	const hasGroupB = flags.commit !== undefined || flags.range !== undefined || flags.against !== undefined;
	const hasGroupA = flags.changed !== undefined || flags.staged !== undefined || flags.unstaged !== undefined || flags.untracked !== undefined;

	// Check mutual exclusivity within Group B
	const activeGroupBFlags = [];
	if (flags.commit !== undefined) activeGroupBFlags.push("--commit");
	if (flags.range !== undefined) activeGroupBFlags.push("--range");
	if (flags.against !== undefined) activeGroupBFlags.push("--against");

	if (activeGroupBFlags.length > 1) {
		errors.push("--commit, --range, and --against are mutually exclusive.");
		return [];
	}

	// Check compatibility between Group A and Group B
	if (hasGroupB && hasGroupA) {
		errors.push("--commit/--range/--against cannot be combined with --changed, --staged, --unstaged, or --untracked.");
		return [];
	}

	let gitOptions: any;
	let defaultOutputName = "git-changes";

	function sanitizeName(name: string): string {
		return name.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
	}

	if (flags.commit !== undefined) {
		const rev = flags.commit.trim();
		if (!rev) {
			errors.push("--commit requires a non-empty revision.");
			return [];
		}
		gitOptions = {
			mode: "commit",
			rev,
			includeDiff: !!flags.includeDiff,
		};
		defaultOutputName = `git-commit-${sanitizeName(rev.slice(0, 8))}`;
	} else if (flags.range !== undefined) {
		const spec = flags.range.trim();
		const match = spec.match(/^(.+?)(\.{2,3})(.+)$/);
		if (!match) {
			errors.push('Invalid range format. Expected "base..head" or "base...head".');
			return [];
		}
		const base = match[1];
		const separator = match[2];
		const head = match[3];
		if (!base || !head) {
			errors.push('Invalid range format. Expected "base..head" or "base...head".');
			return [];
		}
		gitOptions = {
			mode: "range",
			spec,
			base,
			head,
			includeDiff: !!flags.includeDiff,
		};
		defaultOutputName = "git-range";
	} else if (flags.against !== undefined) {
		const base = flags.against.trim();
		if (!base) {
			errors.push("--against requires a non-empty base branch/commit.");
			return [];
		}
		gitOptions = {
			mode: "against",
			base,
			includeDiff: !!flags.includeDiff,
		};
		defaultOutputName = `git-against-${sanitizeName(base)}`;
	} else {
		// Working-tree mode
		const changed = !!flags.changed;
		let staged = !!flags.staged;
		let unstaged = !!flags.unstaged;
		let untracked = !!flags.untracked;

		if (!changed && !staged && !unstaged && !untracked) {
			staged = true;
			unstaged = true;
			untracked = true;
		} else if (changed) {
			staged = true;
			unstaged = true;
			untracked = true;
		}

		gitOptions = {
			mode: "working-tree",
			changed: changed || (!staged && !unstaged && !untracked),
			staged,
			unstaged,
			untracked,
			includeDiff: !!flags.includeDiff,
		};
		defaultOutputName = "git-changes";
	}

	const plan: ExecutionPlan = {
		root,
		command: "git",
		outputName: flags.name ?? defaultOutputName,
		entry: [],
		include: uniqueTrimmed(mergedInclude),
		exclude: uniqueTrimmed(mergedExclude),
		depth,
		maxFiles,
		aliases,
		output: {
			dir: defaultOutput.dir,
			versioned: defaultOutput.versioned,
			format: flags.format ?? defaultOutput.format,
		},
		dryRun: !!flags.dryRun,
		copy: !!flags.copy,
		attachmentOptions,
		gitOptions,
	};

	return [plan];
}
