import { executeCommandWithPlanner } from "./shared-runner";
import type { ProdexFlags, RunResult } from "../types";

export interface ScopeCommandResult {
	runs: RunResult[];
	warnings: string[];
	errors: string[];
	scopes?: string[];
}

export async function scopeCommand(params: {
	rootArg?: string;
	flags?: Partial<ProdexFlags>;
	cwd?: string;
}): Promise<ScopeCommandResult> {
	return executeCommandWithPlanner("scope", params);
}
