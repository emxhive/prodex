import type { ExecutionPlan, SourceCollectionResult } from "../types";
import { collectDependencySources } from "./dependency-source-provider";
import { collectGitSources } from "./git-source-provider";

export interface SourceProvider {
	collect(plan: ExecutionPlan): Promise<SourceCollectionResult>;
}


export async function collectSources(plan: ExecutionPlan): Promise<SourceCollectionResult> {
	switch (plan.command) {
		case "pack":
		case "trace":
		case "scope":
			return collectDependencySources(plan);
		case "git":
			return collectGitSources(plan);
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
