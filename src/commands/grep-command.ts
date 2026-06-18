import { executeCommandWithPlanner } from "./shared-runner";
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
	return executeCommandWithPlanner("grep", params);
}
