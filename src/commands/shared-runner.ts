import { loadProjectContext } from "../app/project-context";
import { createExecutionPlans } from "../app/planner";
import { executeRun } from "../app/execute-run";
import type { ProdexFlags, RunResult } from "../types";
import { ProgressReporter, NoopProgressReporter } from "../app/progress";

export interface PlannerCommandResult {
	runs: RunResult[];
	warnings: string[];
	errors: string[];
	scopes?: string[];
}

export async function executeCommandWithPlanner(
	kind: "pack" | "trace" | "scope" | "git" | "grep",
	params: {
		rootArg?: string;
		flags?: Partial<ProdexFlags>;
		cwd?: string;
		progress?: ProgressReporter;
	}
): Promise<PlannerCommandResult> {
	const reporter = params.progress ?? new NoopProgressReporter();
	reporter.start("loading project");

	const project = loadProjectContext(params.rootArg, params.cwd);
	const warnings = [...project.warnings];
	const errors = [...project.errors];

	if (errors.length) return { runs: [], warnings, errors };

	reporter.update("planning command");

	const planned = createExecutionPlans({
		intent: { kind, rootArg: params.rootArg, flags: params.flags ?? {} },
		userConfig: project.config,
		root: project.root,
	});

	warnings.push(...planned.warnings);
	errors.push(...planned.errors);

	if (errors.length) return { runs: [], warnings, errors };

	if (planned.listScopes) {
		return { runs: [], warnings, errors, scopes: planned.listScopes };
	}

	const runs: RunResult[] = [];
	for (const plan of planned.plans) {
		runs.push(await executeRun(plan, reporter));
	}

	return { runs, warnings, errors };
}
