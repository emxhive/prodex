import fs from "fs";
import { CacheManager } from "../cache/cache-manager";
import { setLoggerOptions } from "../diagnostics/logger";
import { smartNaming } from "../output/naming";
import { executeAttachedCommand } from "../runtime/shell-command-runner";
import { produceOutput } from "../output/produce-output";
import { collectSources } from "./source-collector";
import pkg from "../../package.json";
import type { ExecutionPlan, RunResult, FileSnapshot, CommandOutputResult, ArtifactPayload } from "../types";

export async function executeRun(plan: ExecutionPlan): Promise<RunResult> {
	CacheManager.clear();
	setLoggerOptions(plan as any);

	const warnings: string[] = [];
	const errors: string[] = [];

	const collectResult = await collectSources(plan);
	warnings.push(...collectResult.warnings);
	errors.push(...collectResult.errors);

	const { entries, includes, mode } = collectResult;

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
			scopeKey: plan.scopeKey,
		};
	}

	const hasContent = collectResult.files.length > 0 || (collectResult.sections && collectResult.sections.length > 0);
	if (!hasContent) {
		return {
			ok: false,
			root: plan.root,
			mode,
			entries,
			includes,
			files: [],
			stats: collectResult.stats,
			warnings,
			errors: ["No files or metadata sections matched the selected options."],
			scopeKey: plan.scopeKey,
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
			files: collectResult.files,
			stats: collectResult.stats,
			warnings,
			errors,
			scopeKey: plan.scopeKey,
			plannedCommands: plan.attachmentOptions?.commands ?? [],
		};
	}

	// 1. Snapshot resolved files
	const filesSnapshots: FileSnapshot[] = [];
	for (const file of collectResult.files) {
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
		sections: collectResult.sections,
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
		files: collectResult.files,
		stats: collectResult.stats,
		warnings,
		errors,
		scopeKey: plan.scopeKey,
	};
}
