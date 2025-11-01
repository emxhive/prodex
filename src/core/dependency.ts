import path from "path";
import { CODE_EXTS, RESOLVERS } from "../constants/config";
import { globScan } from "./file-utils";
import { logger } from "../lib/logger";
import { ProdexConfig } from "../types";
import { unique } from "../lib/utils";

export async function followChain(entryFiles, cfg: ProdexConfig) {
	const limit = cfg.resolve.limit;

	logger.debug("🧩 Following dependency chain...");
	const visited = new Set();
	const all = [];
	const expected = new Set();
	const resolved = new Set();
	const resolverDepth = cfg.resolve.depth;

	for (const f of entryFiles) {
		if (visited.has(f)) continue;
		all.push(f);

		const ext = path.extname(f);
		if (!CODE_EXTS.includes(ext)) continue;

		const resolver = RESOLVERS[ext];
		if (resolver) {
			const result = await resolver(f, cfg, visited, 0, resolverDepth);
			const { files, stats } = result;
			all.push(...files);
			stats?.expected?.forEach((x) => expected.add(x));
			stats?.resolved?.forEach((x) => resolved.add(x));
		}

		if (limit && all.length >= limit) {
			logger.warn("⚠️  Limit reached:", limit);
			break;
		}
	}

	return {
		files: unique(all),
		stats: { expected, resolved },
	};
}

export async function applyincludes(cfg, files) {
	_bpt(["APPLY_include", files]);
	const { resolve } = cfg;
	const ROOT = cfg.root;

	const scan = await globScan(resolve.include, { cwd: ROOT });
	logger.debug("APPLY_include", _2j(scan));
	const combined = unique([...files, ...scan.files]);

	_bpt(combined);
	return combined;
}
