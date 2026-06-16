import type { ExecutionPlan, CommandIntent, ProdexConfigFile, CommandAttachmentOptions } from "../../types";

export function buildTracePlan(params: {
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

	if (errors.length) return [];

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
		attachmentOptions,
	};

	return [plan];
}

function unique(items: string[]): string[] {
	return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
