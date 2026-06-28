import type { ExecutionPlan, SourceCollectionResult } from "../types";
import { collectDependencySources } from "./dependency-source-provider";
import { collectGitSources } from "./git-source-provider";
import { collectGrepSources } from "./grep-source-provider";
import { ProgressReporter, NoopProgressReporter } from "./progress";

export interface SourceProvider {
	collect(plan: ExecutionPlan): Promise<SourceCollectionResult>;
}

export async function collectSources(
	plan: ExecutionPlan,
	progress: ProgressReporter = new NoopProgressReporter()
): Promise<SourceCollectionResult> {
	switch (plan.command) {
		case "pack":
		case "trace":
			return collectDependencySources(plan, progress);
		case "scope":
			if (plan.grepOptions !== undefined) {
				return collectGrepSources(plan, progress);
			}
			return collectDependencySources(plan, progress);
		case "git":
			return collectGitSources(plan, progress);
		case "grep":
			return collectGrepSources(plan, progress);
		default: {
			const exhaustiveCheck: never = plan.command;
			return {
				files: [],
				entries: [],
				includes: [],
				mode: "include-only",
				warnings: [],
				errors: [`Unsupported command kind for source collection: ${exhaustiveCheck}`],
			};
		}
	}
}
