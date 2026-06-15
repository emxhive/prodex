import type { ProdexConfig } from "./config.types";

export interface TraceStats {
	expected: Set<string>;
	resolved: Set<string>;
}

export interface ChainResult {
	files: string[];
	stats: TraceStats;
}

export interface TraceOptions {
	entries: string[];
	outputName?: string;
}

export interface TraceParams {
	cfg: ProdexConfig;
	opts: TraceOptions;
}

export interface TraceResult {
	outputPath?: string;
	outputSizeBytes?: number;
	entries: string[];
	files: string[];
	stats?: TraceStats;
}
