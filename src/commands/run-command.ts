import { executeRun } from "../app/execute-run";
import { createRunPlans } from "../app/run-plans";
import type { ProdexFlags, RunResult } from "../types";

export interface RunCommandResult {
	runs: RunResult[];
	warnings: string[];
	errors: string[];
}

export async function runCommand(params: {
	rootArg?: string;
	flags?: Partial<ProdexFlags>;
	cwd?: string;
}): Promise<RunCommandResult> {
	const planned = createRunPlans(params);
	const warnings = [...planned.warnings];
	const errors = [...planned.errors];

	if (errors.length) return { runs: [], warnings, errors };

	const runs: RunResult[] = [];
	for (const plan of planned.plans) {
		runs.push(await executeRun(plan));
	}

	return { runs, warnings, errors };
}
