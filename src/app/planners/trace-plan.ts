import { DEFAULT_PRODEX_CONFIG } from "../../config/default-config";
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
	if (flags.entry && flags.entry.length > 0) {
		errors.push(
			"`prodex trace --entry` has been removed.\n" +
			"Use `prodex trace --target <target> --depth <number>` to trace from a semantic target.\n" +
			"Use `prodex pack --entry <path-or-glob>` to collect files directly."
		);
	}
	if (flags.scope !== undefined) {
		errors.push('Command "trace" does not accept "--scope" (or "-s").');
	}
	if (flags.key !== undefined || flags.all !== undefined || flags.list !== undefined) {
		errors.push('Command "trace" does not accept "--key", "--all", or "--list".');
	}

	let finalDepth = depth;
	const configDepth = userConfig.depth !== undefined && userConfig.depth !== null ? userConfig.depth : DEFAULT_PRODEX_CONFIG.depth!;

	const hasTarget = flags.target && flags.target.length > 0;
	if (!hasTarget) {
		if (!flags.entry || flags.entry.length === 0) {
			errors.push('Command "trace" requires --target.');
		}
	} else {
		// Validate configured default depth
		const configDepthVal = Number(configDepth);
		if (!Number.isInteger(configDepthVal) || configDepthVal < 0) {
			errors.push('--depth must be an integer greater than or equal to 0.');
		}

		if (flags.depth !== undefined && flags.depth !== null) {
			const depthVal = Number(flags.depth);
			if (!Number.isInteger(depthVal) || depthVal < 0) {
				errors.push('--depth must be an integer greater than or equal to 0.');
			} else {
				finalDepth = depthVal;
			}
		} else {
			if (Number.isInteger(configDepthVal) && configDepthVal >= 0) {
				finalDepth = configDepthVal;
				warnings.push(
					`No --depth provided. Using configured default depth: ${finalDepth}.\n` +
					`Override with --depth <number> or -d <number>.`
				);
			}
		}
	}

	if (errors.length) return [];

	const mergedExclude = [...(userConfig.exclude ?? []), ...(flags.exclude ?? [])];

	const plan: ExecutionPlan = {
		root,
		command: "trace",
		outputName: flags.name,
		entry: [],
		target: unique(flags.target ?? []),
		include: unique(flags.include ?? []),
		exclude: unique(mergedExclude),
		depth: finalDepth,
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
