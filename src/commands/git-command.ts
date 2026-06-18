import { executeCommandWithPlanner } from "./shared-runner";
import type { ProdexFlags, RunResult } from "../types";

export interface GitCommandResult {
	runs: RunResult[];
	warnings: string[];
	errors: string[];
}

export async function gitCommand(params: {
	rootArg?: string;
	flags?: Partial<ProdexFlags>;
	cwd?: string;
}): Promise<GitCommandResult> {
	return executeCommandWithPlanner("git", params);
}
