import { isExcluded } from "../filesystem/exclude";
import { scanGlob } from "../filesystem/entry-discovery";
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
		const step1Matches = await scanGlob([entryPattern], root);
		const step1NonExcluded = step1Matches.filter((file) => !isExcluded(file, excludes, root));

		if (step1NonExcluded.length > 0) {
			resolved.push(...step1NonExcluded);
			continue;
		}

		errors.push(`Entry "${entryPattern}" did not match any files.`);
	}

	return {
		entries: [...new Set(resolved)],
		errors,
		warnings,
	};
}
