import type { ProdexConfigFile, ExecutionPlan, CommandIntent } from "../types";
import { DEFAULT_PRODEX_CONFIG } from "../config/default-config";
import { buildPackPlan } from "./planners/pack-plan";
import { buildTracePlan } from "./planners/trace-plan";
import { buildScopePlan } from "./planners/scope-plan";
import { buildGitPlan } from "./planners/git-plan";
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

	if (intent.kind === "pack") {
		const plans = buildPackPlan({
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
		return { plans, warnings, errors };
	}

	if (intent.kind === "trace") {
		const plans = buildTracePlan({
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
		return { plans, warnings, errors };
	}

	if (intent.kind === "scope") {
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
		return {
			plans: scopeResult.plans,
			warnings,
			errors,
			listScopes: scopeResult.listScopes,
		};
	}

	if (intent.kind === "git") {
		const plans = buildGitPlan({
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
		return { plans, warnings, errors };
	}

	return { plans: [], warnings, errors };
}
