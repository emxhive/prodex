import type { ProdexConfigFile, ExecutionPlan, CommandIntent } from "../types";
import { DEFAULT_PRODEX_CONFIG } from "../config/default-config";
import { buildPackPlan } from "./planners/pack-plan";
import { buildTracePlan } from "./planners/trace-plan";
import { buildScopePlan } from "./planners/scope-plan";
import { buildGitPlan } from "./planners/git-plan";
import { buildGrepPlan } from "./planners/grep-plan";
import { parseCommandAttachmentOptions } from "./planners/attachment-options";

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
	const attachmentOptions = parseCommandAttachmentOptions(flags, errors);

	let plans: ExecutionPlan[] = [];
	let listScopes: string[] | undefined;

	if (intent.kind === "pack") {
		plans = buildPackPlan({
			intent,
			userConfig,
			root,
			aliases,
			depth,
			maxFiles,
			defaultOutput,
			attachmentOptions,
			warnings,
			errors,
		});
	} else if (intent.kind === "trace") {
		plans = buildTracePlan({
			intent,
			userConfig,
			root,
			aliases,
			depth,
			maxFiles,
			defaultOutput,
			attachmentOptions,
			warnings,
			errors,
		});
	} else if (intent.kind === "scope") {
		const scopeResult = buildScopePlan({
			intent,
			userConfig,
			root,
			aliases,
			depth,
			maxFiles,
			defaultOutput,
			attachmentOptions,
			warnings,
			errors,
		});
		plans = scopeResult.plans;
		listScopes = scopeResult.listScopes;
	} else if (intent.kind === "git") {
		plans = buildGitPlan({
			intent,
			userConfig,
			root,
			aliases,
			depth,
			maxFiles,
			defaultOutput,
			attachmentOptions,
			warnings,
			errors,
		});
	} else if (intent.kind === "grep") {
		plans = buildGrepPlan({
			intent,
			userConfig,
			root,
			aliases,
			depth,
			maxFiles,
			defaultOutput,
			attachmentOptions,
			warnings,
			errors,
		});
	}

	if (errors.length) {
		return { plans: [], warnings, errors };
	}

	if (flags.copy && plans.length > 1) {
		errors.push(
			"--copy can only be used when exactly one artifact is generated.\n" +
			"Run a single scope or command target, or open the generated files from the output directory."
		);
		return { plans: [], warnings, errors };
	}

	return { plans, warnings, errors, listScopes };
}
