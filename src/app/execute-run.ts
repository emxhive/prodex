import fs from "fs";
import { CacheManager } from "../cache/cache-manager";
import { collectTraceSources } from "../tracing/collect-trace";
import { setLoggerOptions } from "../diagnostics/logger";
import { smartNaming } from "../output/naming";
import { resolveEntries } from "./entry-resolver";
import { executeAttachedCommand } from "../runtime/shell-command-runner";
import { produceOutput } from "../output/produce-output";
import pkg from "../../package.json";
import type { ExecutionPlan, RunResult, FileSnapshot, CommandOutputResult, ArtifactPayload } from "../types";

export async function executeRun(plan: ExecutionPlan): Promise<RunResult> {
	CacheManager.clear();
	setLoggerOptions(plan as any);

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

	if (!traceResult.files.length) {
		return {
			ok: false,
			root: plan.root,
			mode,
			entries,
			includes,
			files: [],
			stats: traceResult.stats,
			warnings,
			errors: ["No files matched the selected entries or include patterns."],
			profile: plan.scopeKey,
		};
	}

	const resolvedOutputName =
		plan.outputName?.trim() ||
		(plan.command === "trace"
			? smartNaming(entries)
			: plan.command === "scope"
				? plan.scopeKey
				: "pack-combined");

	if (plan.dryRun) {
		return {
			ok: true,
			root: plan.root,
			mode,
			outputName: resolvedOutputName,
			entries,
			includes,
			files: traceResult.files,
			stats: traceResult.stats,
			warnings,
			errors,
			profile: plan.scopeKey,
			plannedCommands: plan.attachmentOptions?.commands ?? [],
		};
	}

	// 1. Snapshot resolved files
	const filesSnapshots: FileSnapshot[] = [];
	for (const file of traceResult.files) {
		try {
			const content = fs.readFileSync(file, "utf8");
			filesSnapshots.push({ path: file, content });
		} catch (err: any) {
			filesSnapshots.push({ path: file, content: "", readError: err.message || String(err) });
		}
	}

	// 2. Spawn attached commands sequentially
	const commandOutputs: CommandOutputResult[] = [];
	if (plan.attachmentOptions && plan.attachmentOptions.commands.length > 0) {
		for (const command of plan.attachmentOptions.commands) {
			const cmdRes = await executeAttachedCommand(
				command,
				plan.root,
				plan.attachmentOptions.timeoutSeconds
			);
			commandOutputs.push(cmdRes);

			if (cmdRes.status !== "success") {
				const errorMsg = `Attached command "${command}" failed with status: ${cmdRes.status}`;
				if (plan.attachmentOptions.failOnError) {
					errors.push(errorMsg);
				} else {
					warnings.push(errorMsg);
				}
			}
		}
	}

	// 3. Construct payload and write output
	const payload: ArtifactPayload = {
		root: plan.root,
		files: filesSnapshots,
		commandOutputs,
		metadata: {
			version: pkg.version,
			timestamp: new Date().toISOString(),
			commandKind: plan.command,
			mode,
			outputName: resolvedOutputName,
			entries,
			includes,
			scopeKey: plan.scopeKey,
		},
	};

	let produceResult: { outputPath: string; outputSizeBytes: number } | undefined;
	try {
		produceResult = await produceOutput({
			name: resolvedOutputName,
			payload,
			format: plan.output.format,
			dir: plan.output.dir,
			versioned: plan.output.versioned,
		});
	} catch (err: any) {
		errors.push(`Failed to generate output file: ${err.message || String(err)}`);
	}

	const ok = errors.length === 0 && produceResult !== undefined;

	return {
		ok,
		root: plan.root,
		mode,
		outputPath: produceResult?.outputPath,
		outputSizeBytes: produceResult?.outputSizeBytes,
		outputName: resolvedOutputName,
		entries,
		includes,
		files: traceResult.files,
		stats: traceResult.stats,
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
