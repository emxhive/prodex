import { followChain } from "./follow-chain";
import { buildFinalFileSet } from "../filesystem/file-set";
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
	const files = await buildFinalFileSet({
		root: cfg.root,
		sources: result?.files ?? [],
		include: cfg.include ?? [],
		exclude: cfg.exclude ?? [],
	});

	return {
		files,
		stats: result?.stats ?? { expected: new Set(), resolved: new Set() },
	};
}
