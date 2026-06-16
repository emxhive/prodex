import type { MigrationCommandResult } from "../config/migration";
import type { ProdexFlags } from "./cli.types";
import type { ProdexConfig } from "./config.types";
import type { ChainResult } from "./tracing.types";
import type { ArtifactSection } from "./artifact.types";

export type ProdexCommandKind = "pack" | "trace" | "scope" | "git";
export type ProdexRunMode = "trace" | "include-only" | "mixed" | "git";

export interface SourceCollectionResult {
	files: string[];
	entries: string[];
	includes: string[];
	mode: ProdexRunMode;
	stats?: ChainResult["stats"];
	warnings: string[];
	errors: string[];
	sections?: ArtifactSection[];
}


export type CliCommand =
	| { kind: "pack"; rootArg?: string; flags: Partial<ProdexFlags> }
	| { kind: "trace"; rootArg?: string; flags: Partial<ProdexFlags> }
	| { kind: "scope"; rootArg?: string; flags: Partial<ProdexFlags> }
	| { kind: "git"; rootArg?: string; flags: Partial<ProdexFlags> }
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
	scopeKey?: string;
}

export interface RunResult {
	ok: boolean;
	root: string;
	mode: ProdexRunMode;
	outputPath?: string;
	outputSizeBytes?: number;
	outputName?: string;
	entries: string[];
	includes: string[];
	files: string[];
	stats?: ChainResult["stats"];
	warnings: string[];
	errors: string[];
	scopeKey?: string;
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
