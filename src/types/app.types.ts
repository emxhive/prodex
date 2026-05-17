import type { ChainResult, ProdexConfig, ProdexFlags } from ".";

export type CliCommand =
	| { kind: "run"; rootArg?: string; flags: Partial<ProdexFlags> }
	| { kind: "init"; rootArg?: string; force?: boolean }
	| { kind: "profiles"; rootArg?: string }
	| { kind: "help"; topic?: string }
	| { kind: "version" };

export interface CliParseResult {
	command?: CliCommand;
	warnings: string[];
	errors: string[];
}

export interface RunPlan {
	root: string;
	config: ProdexConfig;
	flags: Partial<ProdexFlags>;
	outputName?: string;
	profile?: string;
}

export interface RunResult {
	ok: boolean;
	root: string;
	mode: "trace" | "include-only" | "mixed";
	outputPath?: string;
	entries: string[];
	includes: string[];
	files: string[];
	stats?: ChainResult["stats"];
	warnings: string[];
	errors: string[];
	profile?: string;
}

export interface CommandResult {
	ok: boolean;
	exitCode: number;
	message?: string;
	profiles?: string[];
	warnings: string[];
	errors: string[];
	runs: RunResult[];
}
