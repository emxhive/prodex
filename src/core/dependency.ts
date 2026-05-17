import path from "path";
import { CODE_EXTS, RESOLVERS } from "../constants/config";
import { globScan } from "./helpers";
import { logger } from "../lib/logger";
import { unique } from "../shared/collections";
import type { ProdexConfig, ResolverParams, ResolverResult } from "../types";
import fs from "fs";
import { normalizePath } from "../platform/path";


/**
 * 🧩 followChain()
 * Traverses all dependencies starting from the given entry files.
 * Uses language-specific resolvers (JS / PHP) under the hood.
 */
export async function followChain(entryFiles: string[], cfg: ProdexConfig) {
	const limit = cfg.resolve.maxFiles;
	const resolverDepth = cfg.resolve.maxDepth;

	logger.debug("🧩 Following dependency chain...");

	const visited = new Set<string>();
	const all: string[] = [];
	const expected = new Set<string>();
	const resolved = new Set<string>();

	for (const f of entryFiles) {
		if (visited.has(f)) continue;
		all.push(f);

		const ext = path.extname(f);
		if (!CODE_EXTS.includes(ext)) continue;

		const resolver = RESOLVERS[ext];
		if (!resolver) continue;

		const params: ResolverParams = {
			cfg,
			filePath: f,
			visited,
			depth: 0,
			maxDepth: resolverDepth,
		};

		let result: ResolverResult | null = null;
		try {
			result = await resolver(params);
		} catch (err: any) {
			logger.warn(`⚠️ Resolver failed for ${f}:`, err.message || err);
			continue;
		}

		if (!result) continue;

		const { files, stats } = result;
		all.push(...files);
		stats.expected.forEach((x) => expected.add(x));
		stats.resolved.forEach((x) => resolved.add(x));

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

/**
 * 🧩 applyIncludes()
 * Scans and appends additional files defined in config.include.
 */
// src/core/dependency.ts

// (existing imports stay)

export async function applyIncludes(cfg: ProdexConfig, files: string[]) {
	const { include, root } = cfg;

	const absFiles: string[] = [];
	const patterns: string[] = [];

	for (const raw of include) {
		const p = String(raw ?? "").trim();
		if (!p) continue;

		const norm = normalizePath(p);

		// absolute *file* paths bypass globScan (and its ignores)
		if (path.isAbsolute(norm)) {
			try {
				if (fs.statSync(norm).isFile()) {
					absFiles.push(path.resolve(norm));
					continue;
				}
			} catch {
				// doesn't exist / can't stat → treat as pattern
			}
		}

		patterns.push(norm);
	}

	const scan = await globScan(patterns, { cwd: root });
	return unique([...files, ...absFiles, ...scan.files]);
}
