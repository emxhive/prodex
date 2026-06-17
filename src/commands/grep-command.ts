import { loadProjectContext } from "../app/project-context";
import { createExecutionPlans } from "../app/planner";
import { executeRun } from "../app/execute-run";
import type { ProdexFlags, RunResult } from "../types";

export interface GrepCommandResult {
	runs: RunResult[];
	warnings: string[];
	errors: string[];
}

export async function grepCommand(params: {
	rootArg?: string;
	flags?: Partial<ProdexFlags>;
	cwd?: string;
}): Promise<GrepCommandResult> {
	const project = loadProjectContext(params.rootArg, params.cwd);
	const warnings = [...project.warnings];
	const errors = [...project.errors];

	if (errors.length) return { runs: [], warnings, errors };

	const planned = createExecutionPlans({
		intent: { kind: "grep", rootArg: params.rootArg, flags: params.flags ?? {} },
		userConfig: project.config,
		root: project.root,
	});

	warnings.push(...planned.warnings);
	errors.push(...planned.errors);

	if (errors.length) return { runs: [], warnings, errors };

	const runs: RunResult[] = [];
	for (const plan of planned.plans) {
		runs.push(await executeRun(plan));
	}

	return { runs, warnings, errors };
}
