import type { ProdexConfig } from "./config.types";
import type { OwnershipDiagnostic } from "../dependency/ownership/types";

export interface TraceStats {
	expected: Set<string>;
	resolved: Set<string>;
}

export interface ChainResult {
	files: string[];
	stats: TraceStats;
	diagnostics?: OwnershipDiagnostic[];
}

export interface TraceOptions {
	entries: string[];
	outputName?: string;
}
