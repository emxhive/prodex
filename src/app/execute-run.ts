import { CacheManager } from "../cache/cache-manager";
import { globScan } from "../filesystem/glob-scan";
import { runTrace } from "../tracing/trace-run";
import { setLoggerOptions } from "../diagnostics/logger";
import type { RunPlan, RunResult } from "../types";

export async function executeRun(plan: RunPlan): Promise<RunResult> {
	CacheManager.clear();
	setLoggerOptions(plan.flags);

	const warnings: string[] = [];
	const errors: string[] = [];
	const entries = await resolveHeadlessEntries(plan);
	const includes = plan.config.include ?? [];
	const mode = getRunMode(entries.length, includes.length);

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
			profile: plan.profile,
		};
	}

	const result = await runTrace({
		cfg: plan.config,
		opts: {
			entries,
			outputName: plan.outputName,
		},
	});

	if (!result.outputPath) {
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
			profile: plan.profile,
		};
	}

	return {
		ok: true,
		root: plan.root,
		mode,
		outputPath: result.outputPath,
		outputName: plan.outputName,
		entries,
		includes,
		files: result.files,
		stats: result.stats,
		warnings,
		errors,
		profile: plan.profile,
	};
}

async function resolveHeadlessEntries(plan: RunPlan): Promise<string[]> {
	return (await globScan(plan.config.entry, { cwd: plan.root })).files;
}

function getRunMode(entryCount: number, includePatternCount: number): RunResult["mode"] {
	if (entryCount && includePatternCount) return "mixed";
	if (entryCount) return "trace";
	return "include-only";
}
