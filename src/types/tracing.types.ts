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
