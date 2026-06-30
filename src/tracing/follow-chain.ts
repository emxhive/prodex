import path from "path";
import { logger } from "../diagnostics/logger";
import { isExcluded } from "../filesystem/exclude";
import { mergeStats, newStats, unique } from "./trace-stats";
import type { ProdexConfig, ResolverParams, ResolverResult } from "../types";
import { getResolver, hasResolver } from "./resolver-registry";

export async function followChain(entryFiles: string[], cfg: ProdexConfig) {
	const limit = cfg.maxFiles;
	const resolverDepth = cfg.depth;

	logger.debug("Following dependency chain...");

	const visited = new Set<string>();
	const all: string[] = [];
	const stats = newStats();

	for (const file of entryFiles) {
		await visitFile(file, 0);
	}

	return {
		files: unique(all),
		stats,
	};

	async function visitFile(file: string, depth: number): Promise<void> {
		if (visited.has(file)) return;
		visited.add(file);
		all.push(file);

		if (limit && all.length >= limit) {
			logger.warn("File limit reached:", limit);
			return;
		}

		if (depth >= resolverDepth) return;

		const ext = path.extname(file);
		if (!hasResolver(ext)) return;

		const resolver = getResolver(ext);
		if (!resolver) return;

		const params: ResolverParams = { cfg, filePath: file };
		let result: ResolverResult | null = null;
		try {
			result = await resolver(params);
		} catch (err: any) {
			logger.warn(`Resolver failed for ${file}:`, err.message || err);
			return;
		}

		if (!result) return;

		mergeStats(stats, result.stats);

		for (const resolvedFile of result.files) {
			if (isExcluded(resolvedFile, cfg.exclude, cfg.root)) continue;
			if (limit && all.length >= limit) return;
			await visitFile(resolvedFile, depth + 1);
		}
	}
}
