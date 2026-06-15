import { CacheManager } from "../cache/cache-manager";
import { runTrace } from "../tracing/trace-run";
import { setLoggerOptions } from "../diagnostics/logger";
import { smartNaming } from "../output/naming";
import { resolveEntries } from "./entry-resolver";
import type { ExecutionPlan, RunResult, ProdexConfig } from "../types";

export async function executeRun(plan: ExecutionPlan): Promise<RunResult> {
	CacheManager.clear();
	setLoggerOptions(plan as any); // plan has format, debug, etc.

	const warnings: string[] = [];
	const errors: string[] = [];

	const resolveResult = await resolveEntries(plan);
	warnings.push(...resolveResult.warnings);
	errors.push(...resolveResult.errors);

	const entries = resolveResult.entries;
	const includes = plan.include ?? [];
	const mode = getRunMode(entries.length, includes.length);

	if (errors.length) {
		return {
			ok: false,
			root: plan.root,
			mode,
			entries,
			includes,
			files: [],
			warnings,
			errors,
			profile: plan.scopeKey,
		};
	}

	if (!entries.length && !includes.length) {
		return {
			ok: false,
			root: plan.root,
			mode,
			entries,
			includes,
			files: [],
			warnings,
			errors: ["No entry files found and no include patterns were configured."],
			profile: plan.scopeKey,
		};
	}

	const resolvedOutputName = plan.outputName?.trim() || (plan.command === "trace" ? smartNaming(entries) : (plan.command === "scope" ? plan.scopeKey : "pack-combined"));

	const config: ProdexConfig = {
		root: plan.root,
		name: plan.outputName,
		entry: plan.entry,
		include: plan.include,
		exclude: plan.exclude,
		aliases: plan.aliases,
		depth: plan.depth,
		maxFiles: plan.maxFiles,
		output: plan.output,
		scopes: {},
		dryRun: plan.dryRun,
	};

	const result = await runTrace({
		cfg: config,
		opts: {
			entries,
			outputName: plan.outputName,
		},
	});

	if (!result.outputPath && !plan.dryRun) {
		return {
			ok: false,
			root: plan.root,
			mode,
			entries,
			includes,
			files: result.files,
			stats: result.stats,
			warnings,
			errors: ["No files matched the selected entries or include patterns."],
			profile: plan.scopeKey,
		};
	}

	return {
		ok: true,
		root: plan.root,
		mode,
		outputPath: result.outputPath,
		outputSizeBytes: result.outputSizeBytes,
		outputName: resolvedOutputName,
		entries,
		includes,
		files: result.files,
		stats: result.stats,
		warnings,
		errors,
		profile: plan.scopeKey,
	};
}

function getRunMode(entryCount: number, includePatternCount: number): RunResult["mode"] {
	if (entryCount && includePatternCount) return "mixed";
	if (entryCount) return "trace";
	return "include-only";
}

