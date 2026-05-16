import { applyIncludes, followChain } from "./dependency";
import { smartNaming } from "./helpers";
import { produceOutput } from "./output";
import type { CombineParams, CombineResult } from "../types";

export async function runCombine({ cfg, opts }: CombineParams): Promise<CombineResult> {
	const entries = opts.entries ?? [];
	const result = entries.length ? await followChain(entries, cfg) : undefined;
	const files = await applyIncludes(cfg, result?.files ?? []);

	if (!files.length) {
		return { entries, files: [], stats: result?.stats };
	}

	const outputPath = await produceOutput({
		name: opts.outputName ?? smartNaming(entries),
		files,
		cfg,
	});

	return { outputPath, entries, files, stats: result?.stats };
}
