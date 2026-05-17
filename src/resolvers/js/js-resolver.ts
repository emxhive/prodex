import path from "path";
import { extractImports } from "./extract-imports";
import { BASE_EXTS, DTS_EXT, REAL_EXTS } from "../../constants/config";
import { emptyResult, mergeStats, newStats, unique } from "../../shared/collections";
import { logger } from "../../lib/logger";
import { resolveAliasPath } from "./resolve-alias"; // alias: config + cache + fast-glob
import type { ResolverParams, ResolverResult } from "../../types";
import { CacheManager } from "../../core/managers/cache";
import { CACHE_KEYS } from "../../constants/cache-keys";
import { isExcluded, readFileSafe, safeStatCached } from "../../shared";
import { setDiff } from "../../shared";

const { JS_STATS, JS_IMPORTS } = CACHE_KEYS;

export async function resolveJsImports({ cfg, filePath, visited = new Set(), depth = 0, maxDepth }: ResolverParams): Promise<ResolverResult> {
	const limitDepth = maxDepth ?? cfg.resolve.maxDepth;

	if (depth >= limitDepth) return emptyResult(visited);
	if (visited.has(filePath)) return emptyResult(visited);
	visited.add(filePath);

	const {
		root: ROOT,
		exclude: excludePatterns,
	} = cfg;

	const ext = path.extname(filePath).toLowerCase();
	const isDts = ext === DTS_EXT;
	if (!BASE_EXTS.includes(ext) && !isDts) return emptyResult(visited);

	let code = readFileSafe(filePath);
	if (!code) return emptyResult(visited);

	// Extract imports ---------------------------------------
	const imports = await getImportsCached(filePath, code);
	if (!imports.size) return emptyResult(visited);

	// Trackers ----------------------------------------------
	const stats = newStats();
	const files: string[] = [];

	// Main resolution loop ----------------------------------
	for (const imp of imports) {
		// skip bare packages (react, lodash, etc.)
		if (!imp.startsWith(".") && !imp.startsWith("/") && !imp.startsWith("@")) continue;
		if (isExcluded(imp, excludePatterns, ROOT)) continue;

		let base: string | null = null;

		if (imp.startsWith(".")) {
			// relative → like original resolver
			base = path.resolve(path.dirname(filePath), imp);
		} else if (imp.startsWith("/")) {
			// absolute path import → like original resolver
			base = path.resolve(imp);
		} else {
			// alias (@...) → unified resolver (config + cache + glob)
			base = await resolveAliasPath(imp, ROOT, cfg);
		}

		if (!base) continue;

		const absBase = path.resolve(base);
		// Exclusion check after alias resolution
		if (isExcluded(absBase, excludePatterns, ROOT)) continue;

		const resolvedPath = await tryResolveImport(absBase);
		// Exclusion check after final resolution
		if (isExcluded(resolvedPath, excludePatterns, ROOT)) continue;

		stats.expected.add(absBase);
		if (!resolvedPath) continue;

		stats.resolved.add(absBase);
		files.push(resolvedPath);

		// Recursive traversal
		const sub = await resolveJsImports({
			cfg,
			filePath: resolvedPath,
			visited,
			depth: depth + 1,
			maxDepth: limitDepth,
		});

		files.push(...sub.files);
		mergeStats(stats, sub.stats);
	}

	const uniqueFiles = unique(files);
	const diff = setDiff(stats.expected, stats.resolved);

	logger.debug(`🪶 [js-resolver] ${filePath} → expected: ${stats.expected.size}, resolved: ${stats.resolved.size}`);
	if (diff.size) logger.debug([...diff], "🔴 THE diff");

	return { files: uniqueFiles, visited, stats };
}

// ---------------------------------------------------------
// tryResolveImport (pure)
// ---------------------------------------------------------
async function tryResolveImport(basePath: string): Promise<string | null> {
	const candidates: string[] = [];

	const ext = path.extname(basePath).toLowerCase();
	if (ext && REAL_EXTS.has(ext)) {
		candidates.push(basePath);
	} else {
		for (const e of [...BASE_EXTS, DTS_EXT]) {
			candidates.push(basePath + e);
			candidates.push(path.join(basePath, "index" + e));
		}
	}
	// Run all stat checks in parallel
	const results = await Promise.allSettled(
		candidates.map(async (c) => {
			const abs = path.resolve(c);
			const st = await safeStatCached(JS_STATS, abs);
			return st && st.isFile() ? abs : null;
		})
	);

	// Find the first fulfilled non-null result
	for (const r of results) {
		if (r.status === "fulfilled" && r.value) return r.value;
	}

	return null;
}

// ---------------------------------------------------------
// Cached stat + import scanners
// ---------------------------------------------------------

async function getImportsCached(filePath: string, code: string): Promise<Set<string>> {
	const cached = CacheManager.get(JS_IMPORTS, filePath);
	if (cached) return cached;
	const set = await extractImports(filePath, code);
	CacheManager.set(JS_IMPORTS, filePath, set);
	return set;
}
