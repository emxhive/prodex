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
}

/** Options accepted by runCombine (keep lean). */
export interface CombineOptions {
	entries: string[];
	outputName?: string;
}

export interface CombineParams {
	cfg: ProdexConfig;
	opts: CombineOptions;
}

export interface CombineResult {
	outputPath?: string;
	entries: string[];
	files: string[];
	stats?: Stats;
}

/**
 * 🧠 Cache Type Definitions for Prodex
 * Runtime cache registry for resolver-discovered aliases and other ephemeral data.
 */

export interface AliasCache {
	[alias: string]: string;
}

/**
 * Core cache registry shape.
 * Extend this interface to include other cache namespaces (fileCache, statsCache, etc.)
 */
export interface CacheRegistry {
	aliases: Map<string, string>;
}
