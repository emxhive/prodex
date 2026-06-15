import path from "path";
import { isExcluded } from "../tracing/exclude";
import { scanGlob, expandPathLike, discoverBareName } from "../filesystem/entry-discovery";
import { rel } from "../filesystem/read-file";
import type { ExecutionPlan } from "../types";

export interface EntryResolutionResult {
	entries: string[];
	warnings: string[];
	errors: string[];
}

export async function resolveEntries(plan: ExecutionPlan): Promise<EntryResolutionResult> {
	const resolved: string[] = [];
	const errors: string[] = [];
	const warnings: string[] = [];

	const root = plan.root;
	const excludes = plan.exclude;

	for (const entryPattern of plan.entry) {
		const isPathLike = entryPattern.includes("/") || entryPattern.includes("\\");
		const hasExt = path.extname(entryPattern) !== "";

		// Step 1: Exact/Glob Match
		const step1Matches = await scanGlob([entryPattern], root);
		const step1NonExcluded = step1Matches.filter((file) => !isExcluded(file, excludes, root));

		if (step1NonExcluded.length > 0) {
			resolved.push(...step1NonExcluded);
			continue;
		}

		// Step 2: Extensionless Path Expansion
		let step2NonExcluded: string[] = [];
		if (!hasExt) {
			const step2Matches = expandPathLike(entryPattern, root);
			step2NonExcluded = step2Matches.filter((file) => !isExcluded(file, excludes, root));

			if (step2NonExcluded.length === 1) {
				resolved.push(step2NonExcluded[0]);
				continue;
			} else if (step2NonExcluded.length > 1) {
				errors.push(formatAmbiguityError(entryPattern, step2NonExcluded, root, plan.command));
				continue;
			}
		}

		// Step 3: Bare-Name Discovery (only if pattern has no path separators)
		if (!isPathLike) {
			const step3Matches = await discoverBareName(entryPattern, root);
			const step3NonExcluded = step3Matches.filter((file) => !isExcluded(file, excludes, root));

			if (step3NonExcluded.length === 1) {
				resolved.push(step3NonExcluded[0]);
				continue;
			} else if (step3NonExcluded.length > 1) {
				errors.push(formatAmbiguityError(entryPattern, step3NonExcluded, root, plan.command));
				continue;
			}
		}

		// If we get here, 0 matches were found
		errors.push(`Entry "${entryPattern}" did not match any files.`);
	}

	return {
		entries: [...new Set(resolved)],
		errors,
		warnings,
	};
}

function formatAmbiguityError(entryPattern: string, candidates: string[], root: string, command: string): string {
	const relativeCandidates = candidates
		.map((c) => `  prodex ${command} -e ${rel(c, root)}`)
		.join("\n");
	return `Entry "${entryPattern}" matched multiple files.\n\nUse a more specific entry:\n${relativeCandidates}`;
}
