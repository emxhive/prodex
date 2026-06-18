import { executeCommandWithPlanner } from "./shared-runner";
import type { ProdexFlags, RunResult } from "../types";

export interface TraceCommandResult {
	runs: RunResult[];
	warnings: string[];
	errors: string[];
}

export async function traceCommand(params: {
	rootArg?: string;
	flags?: Partial<ProdexFlags>;
	cwd?: string;
}): Promise<TraceCommandResult> {
	return executeCommandWithPlanner("trace", params);
}
