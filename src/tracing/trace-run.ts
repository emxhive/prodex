import { followChain } from "./follow-chain";
import { applyIncludes } from "./include-files";
import { smartNaming } from "../output/naming";
import { produceOutput } from "../output/produce-output";
import type { TraceParams, TraceResult } from "../types";

export async function runTrace({ cfg, opts }: TraceParams): Promise<TraceResult> {
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
