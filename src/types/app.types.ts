import type { MigrationCommandResult } from "../config/migration";
import type { ProdexFlags } from "./cli.types";
import type { ProdexConfig } from "./config.types";
import type { ChainResult } from "./tracing.types";

export type CliCommand =
	| { kind: "pack"; rootArg?: string; flags: Partial<ProdexFlags> }
	| { kind: "trace"; rootArg?: string; flags: Partial<ProdexFlags> }
	| { kind: "scope"; rootArg?: string; flags: Partial<ProdexFlags> }
	| { kind: "init"; rootArg?: string; force?: boolean }
	| { kind: "migrate"; rootArg?: string; write?: boolean; check?: boolean }
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
	outputSizeBytes?: number;
	outputName?: string;
	entries: string[];
	includes: string[];
	files: string[];
	stats?: ChainResult["stats"];
	warnings: string[];
	errors: string[];
	profile?: string;
	plannedCommands?: string[];
}

export interface CommandResult {
	ok: boolean;
	exitCode: number;
	message?: string;
	scopes?: string[];
	migration?: MigrationCommandResult;
	warnings: string[];
	errors: string[];
	runs: RunResult[];
}
