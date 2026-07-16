import { resolveEntries } from "./entry-resolver";
import { resolveTargets } from "./target-resolver";
import { collectTraceSources } from "../tracing/collect-trace";
import type { ExecutionPlan, SourceCollectionResult } from "../types";
import { ProgressReporter, NoopProgressReporter } from "./progress";

export async function collectDependencySources(
	plan: ExecutionPlan,
	progress: ProgressReporter = new NoopProgressReporter()
): Promise<SourceCollectionResult> {
	const warnings: string[] = [];
	const errors: string[] = [];

	if (plan.command === "trace") {
		const targetName = plan.target && plan.target.length > 0 ? plan.target.join(", ") : undefined;
		progress.update("resolving target", targetName);
	} else {
		progress.update("collecting files");
	}

	const resolveResult = plan.command === "trace"
		? await resolveTargets(plan)
		: await resolveEntries(plan);
	warnings.push(...resolveResult.warnings);
	errors.push(...resolveResult.errors);

	const entries = resolveResult.entries;
	const includes = plan.include ?? [];
	const mode = getRunMode(entries.length, includes.length, !!plan.allowEmptyCollection);

	if (errors.length) {
		return { files: [], entries, includes, mode, warnings, errors };
	}

	if (!entries.length && !includes.length) {
		if (plan.allowEmptyCollection) {
			return {
				files: [],
				entries,
				includes,
				mode,
				warnings,
				errors,
			};
		}

		return {
			files: [],
			entries,
			includes,
			mode,
			warnings,
			errors: ["No entry files found and no include patterns were configured."],
		};
	}

	if (plan.command === "trace") {
		progress.update("collecting dependency graph");
	}

	const traceResult = await collectTraceSources({
		cfg: {
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
		},
		opts: {
			entries,
			outputName: plan.outputName,
		},
	});
	for (const diagnostic of traceResult.diagnostics ?? []) {
		if (diagnostic.message) warnings.push(diagnostic.message);
	}

	return {
		files: traceResult.files,
		entries,
		includes,
		mode,
		stats: traceResult.stats,
		warnings,
		errors,
	};
}

function getRunMode(entryCount: number, includePatternCount: number, allowEmptyCollection: boolean): "trace" | "include-only" | "mixed" | "command-only" {
	if (entryCount && includePatternCount) return "mixed";
	if (entryCount) return "trace";
	if (allowEmptyCollection) return "command-only";
	return "include-only";
}
