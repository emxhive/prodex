import fs from "fs";
import path from "path";
import { CacheManager } from "../cache/cache-manager";
import { setLoggerOptions } from "../diagnostics/logger";
import { smartNaming } from "../output/naming";
import { executeAttachedCommand } from "../runtime/shell-command-runner";
import { produceOutput } from "../output/produce-output";
import { collectSources } from "./source-collector";
import pkg from "../../package.json";
import type { ExecutionPlan, RunResult, FileSnapshot, CommandOutputResult, ArtifactPayload, ArtifactSection } from "../types";
import { ProgressReporter, NoopProgressReporter } from "./progress";

function hasMeaningfulSectionContent(section: ArtifactSection): boolean {
	const content = section.content.trim();
	if (!content) return false;

	const normalized = content.toLowerCase();
	return ![
		"(none)",
		"(no changes)",
		"(no cached diff stat)",
	].includes(normalized);
}

export async function executeRun(
	plan: ExecutionPlan,
	progress: ProgressReporter = new NoopProgressReporter()
): Promise<RunResult> {
	CacheManager.clear();
	setLoggerOptions(plan as any);

	const warnings: string[] = [];
	const errors: string[] = [];

	const collectResult = await collectSources(plan, progress);
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

	const rawSections = collectResult.sections ?? [];
	const filteredSections = rawSections.filter(hasMeaningfulSectionContent);

	const hasContent = collectResult.files.length > 0 || filteredSections.length > 0;
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
	progress.update("snapshotting files");
	const filesSnapshots: FileSnapshot[] = [];
	const snapshotsMap = new Map<string, FileSnapshot>();
	if (collectResult.snapshots) {
		for (const snap of collectResult.snapshots) {
			snapshotsMap.set(snap.path, snap);
		}
	}

	for (const file of collectResult.files) {
		const cachedSnap = snapshotsMap.get(file);
		if (cachedSnap) {
			filesSnapshots.push(cachedSnap);
		} else {
			try {
				const content = fs.readFileSync(file, "utf8");
				filesSnapshots.push({ path: file, content });
			} catch (err: any) {
				filesSnapshots.push({ path: file, content: "", readError: err.message || String(err) });
			}
		}
	}

	// 2. Spawn attached commands sequentially
	const commandOutputs: CommandOutputResult[] = [];
	if (plan.attachmentOptions && plan.attachmentOptions.commands.length > 0) {
		progress.update("running attached commands");
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
	progress.update("rendering artifact");
	const payload: ArtifactPayload = {
		root: plan.root,
		sections: filteredSections,
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
			targets: plan.target,
			depth: plan.depth,
		},
	};

	let produceResult: { outputPath: string; outputSizeBytes: number } | undefined;
	try {
		progress.update("writing output");
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

	if (ok && produceResult) {
		const relativePath = path.relative(process.cwd(), produceResult.outputPath).replace(/\\/g, "/");
		progress.complete("wrote", relativePath);
	}

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
