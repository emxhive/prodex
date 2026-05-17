import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";
import { normalizePath } from "../platform/path";
import { unique } from "../shared/collections";
import type { ProdexConfig, ResolverParams, ResolverResult } from "../types";
import { globScan } from "./helpers";
import { getResolver, hasResolver } from "./resolver-registry";

export async function followChain(entryFiles: string[], cfg: ProdexConfig) {
	const limit = cfg.resolve.maxFiles;
	const resolverDepth = cfg.resolve.maxDepth;

	logger.debug("Following dependency chain...");

	const visited = new Set<string>();
	const all: string[] = [];
	const expected = new Set<string>();
	const resolved = new Set<string>();

	for (const file of entryFiles) {
		if (visited.has(file)) continue;
		all.push(file);

		const ext = path.extname(file);
		if (!hasResolver(ext)) continue;

		const resolver = getResolver(ext);
		if (!resolver) continue;

		const params: ResolverParams = {
			cfg,
			filePath: file,
			visited,
			depth: 0,
			maxDepth: resolverDepth,
		};

		let result: ResolverResult | null = null;
		try {
			result = await resolver(params);
		} catch (err: any) {
			logger.warn(`Resolver failed for ${file}:`, err.message || err);
			continue;
		}

		if (!result) continue;

		const { files, stats } = result;
		all.push(...files);
		stats.expected.forEach((item) => expected.add(item));
		stats.resolved.forEach((item) => resolved.add(item));

		if (limit && all.length >= limit) {
			logger.warn("File limit reached:", limit);
			break;
		}
	}

	return {
		files: unique(all),
		stats: { expected, resolved },
	};
}

export async function applyIncludes(cfg: ProdexConfig, files: string[]) {
	const { include, root } = cfg;
	const absoluteFiles: string[] = [];
	const patterns: string[] = [];

	for (const raw of include) {
		const candidate = String(raw ?? "").trim();
		if (!candidate) continue;

		const normalized = normalizePath(candidate);
		if (path.isAbsolute(normalized)) {
			try {
				if (fs.statSync(normalized).isFile()) {
					absoluteFiles.push(path.resolve(normalized));
					continue;
				}
			} catch {
				// Treat unreadable absolute paths as glob patterns so include handling stays consistent.
			}
		}

		patterns.push(normalized);
	}

	const scan = await globScan(patterns, { cwd: root });
	return unique([...files, ...absoluteFiles, ...scan.files]);
}
