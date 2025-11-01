import { ProdexConfig } from ".";

/** Shared stats type across resolvers and chain results. */
export interface Stats {
	expected: Set<string>;
	resolved: Set<string>;
}

/** Followed dependency chain result. */
export interface ChainResult {
	files: string[];
	stats: Stats;
}

/** Parameters for producing the final output trace file. */
export interface OutputParams {
	/** Fully resolved + included file list (already dependency-expanded). */
	files: string[];

	name: string;

	/** Active Prodex configuration (merged + flag-overridden). */
	cfg: ProdexConfig;

	/** Whether to show interactive prompts for filename override. */
	showUi: boolean;
}

/** Options accepted by runCombine (keep lean). */
export interface CombineOptions {
	showUi: boolean;
	cliName: string;
}

export interface CombineParams {
	cfg: ProdexConfig;
	opts: CombineOptions;
}
