import type { ExecutionPlan, CommandIntent, ProdexConfigFile, CommandAttachmentOptions } from "../../types";
import { normalizePathOrGlob } from "../../filesystem/path-patterns";
import { uniqueTrimmed } from "./list-utils";

export function buildGrepPlan(params: {
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

	// Validate unsupported options
	if (flags.entry !== undefined || flags.target !== undefined || flags.scope !== undefined || flags.key !== undefined || flags.all !== undefined || flags.list !== undefined) {
		errors.push('Command "grep" does not accept "--entry", "--target", "--scope", "--key", "--all", or "--list".');
		return [];
	}

	// Mode validation
	const modesCount =
		(flags.query !== undefined ? 1 : 0) +
		(flags.any !== undefined ? 1 : 0) +
		(flags.grepAll !== undefined ? 1 : 0) +
		(flags.regex !== undefined ? 1 : 0);

	if (modesCount === 0) {
		errors.push('Command "grep" requires one search mode: --query, --any, --all, or --regex.');
		return [];
	} else if (modesCount > 1) {
		errors.push('Command "grep" accepts only one positive search mode.');
		return [];
	}

	let mode: "query" | "any" | "all" | "regex" = "query";
	let terms: string[] = [];

	if (flags.query !== undefined) {
		mode = "query";
		if (!flags.query.trim()) {
			errors.push("Search terms cannot be blank.");
		} else {
			terms = [flags.query];
		}
	} else if (flags.any !== undefined) {
		mode = "any";
		if (flags.any.length === 0 || flags.any.some(t => !t.trim())) {
			errors.push("Search terms cannot be blank.");
		} else {
			terms = flags.any;
		}
	} else if (flags.grepAll !== undefined) {
		mode = "all";
		if (flags.grepAll.length === 0 || flags.grepAll.some(t => !t.trim())) {
			errors.push("Search terms cannot be blank.");
		} else {
			terms = flags.grepAll;
		}
	} else if (flags.regex !== undefined) {
		mode = "regex";
		if (!flags.regex.trim()) {
			errors.push("Search terms cannot be blank.");
		} else {
			terms = [flags.regex];
		}
	}

	let negativeTerms: string[] = [];
	if (flags.not !== undefined) {
		if (flags.not.length === 0 || flags.not.some(t => !t.trim())) {
			errors.push("Search terms cannot be blank.");
		} else {
			negativeTerms = flags.not;
		}
	}

	// Invalid max files validation
	const resolvedMaxFiles = flags.maxFiles !== undefined ? flags.maxFiles : maxFiles;
	if (resolvedMaxFiles !== undefined && resolvedMaxFiles !== null) {
		if (!Number.isInteger(resolvedMaxFiles) || resolvedMaxFiles <= 0) {
			errors.push("--max-files must be an integer greater than 0.");
		}
	}

	if (errors.length) {
		return [];
	}

	const rootExclude = userConfig.exclude ?? [];
	const mergedWithin = (flags.within ?? []).map((item) => normalizePathOrGlob(item, root, { role: "within" }));
	const mergedSkip = (flags.skip ?? []).map((item) => normalizePathOrGlob(item, root, { role: "skip" }));
	const mergedInclude = (flags.include ?? []).map((item) => normalizePathOrGlob(item, root, { role: "include" }));
	const mergedExclude = [...rootExclude, ...(flags.exclude ?? [])].map((item) => normalizePathOrGlob(item, root, { role: "exclude" }));

	const plan: ExecutionPlan = {
		root,
		command: "grep",
		outputName: flags.name ?? "grep-results",
		entry: [],
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
		copy: !!flags.copy,
		attachmentOptions,
		grepOptions: {
			mode,
			terms,
			negativeTerms: uniqueTrimmed(negativeTerms),
			within: uniqueTrimmed(mergedWithin),
			skip: uniqueTrimmed(mergedSkip),
		},
	};

	return [plan];
}
