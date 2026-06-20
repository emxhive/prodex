import type { ExecutionPlan, SourceCollectionResult } from "../types";
import { collectDependencySources } from "./dependency-source-provider";
import { collectGitSources } from "./git-source-provider";
import { collectGrepSources } from "./grep-source-provider";

export interface SourceProvider {
	collect(plan: ExecutionPlan): Promise<SourceCollectionResult>;
}


export async function collectSources(plan: ExecutionPlan): Promise<SourceCollectionResult> {
	switch (plan.command) {
		case "pack":
		case "trace":
			return collectDependencySources(plan);
		case "scope":
			if (plan.grepOptions !== undefined) {
				return collectGrepSources(plan);
			}
			return collectDependencySources(plan);
		case "git":
			return collectGitSources(plan);
		case "grep":
			return collectGrepSources(plan);
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
