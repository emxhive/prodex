import { followChain } from "./follow-chain";
import { applyIncludes } from "./include-files";
import type { ProdexConfig, TraceOptions, ChainResult } from "../types";

export interface CollectSourcesParams {
	cfg: ProdexConfig;
	opts: TraceOptions;
}

/**
 * Pure source provider that resolves dependency chain and includes.
 * Does not write output or have logging side-effects.
 */
export async function collectTraceSources({ cfg, opts }: CollectSourcesParams): Promise<ChainResult> {
	const entries = opts.entries ?? [];
	const result = entries.length ? await followChain(entries, cfg) : undefined;
	const files = await applyIncludes(cfg, result?.files ?? []);

	return {
		files,
		stats: result?.stats ?? { expected: new Set(), resolved: new Set() },
	};
}
