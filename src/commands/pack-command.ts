import { executeCommandWithPlanner } from "./shared-runner";
import type { ProdexFlags, RunResult } from "../types";

export interface PackCommandResult {
	runs: RunResult[];
	warnings: string[];
	errors: string[];
}

export async function packCommand(params: {
	rootArg?: string;
	flags?: Partial<ProdexFlags>;
	cwd?: string;
}): Promise<PackCommandResult> {
	return executeCommandWithPlanner("pack", params);
}
