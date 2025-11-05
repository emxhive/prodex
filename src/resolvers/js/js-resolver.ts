import path from "path";
import { extractImports } from "./extract-imports";
import { BASE_EXTS, DTS_EXT, REAL_EXTS } from "../../constants/config";
import { emptyResult, unique } from "../../shared/collections";
import { logger } from "../../lib/logger";
import { getConfig } from "../../store";
import { resolveAliasPath } from "./resolve-alias"; // alias: config + cache + fast-glob
import type { ResolverParams, ResolverResult } from "../../types";
import { CacheManager } from "../../core/managers/cache";
import { CACHE_KEYS } from "../../constants/cache-keys";
import { isExcluded, readFileSafe, safeStatCached } from "../../shared";
import { setDiff } from "../../shared";

const { JS_STATS, JS_IMPORTS } = CACHE_KEYS;

export async function resolveJsImports({ filePath, visited = new Set(), depth = 0, maxDepth }: ResolverParams): Promise<ResolverResult> {
	const limitDepth = maxDepth;

	if (depth >= limitDepth) return emptyResult(visited);
	if (visited.has(filePath)) return emptyResult(visited);
	visited.add(filePath);

	const {
		root: ROOT,
		resolve: { exclude: excludePatterns },
	} = getConfig();

	const ext = path.extname(filePath).toLowerCase();
	const isDts = ext === DTS_EXT;
	if (!BASE_EXTS.includes(ext) && !isDts) return emptyResult(visited);

	let code = readFileSafe(filePath);
	if (!code) return emptyResult(visited);

	// Extract imports ---------------------------------------
	const imports = await getImportsCached(filePath, code);
	if (!imports.size) return emptyResult(visited);

	// Trackers ----------------------------------------------
	const expected = new Set<string>();
	const resolved = new Set<string>();
	const files: string[] = [];

	// Main resolution loop ----------------------------------
	for (const imp of imports) {
		// skip bare packages (react, lodash, etc.)
		if (!imp.startsWith(".") && !imp.startsWith("/") && !imp.startsWith("@")) continue;
		if (isExcluded(imp, excludePatterns)) continue;

		let base: string | null = null;

		if (imp.startsWith(".")) {
			// relative → like original resolver
			base = path.resolve(path.dirname(filePath), imp);
		} else if (imp.startsWith("/")) {
			// absolute path import → like original resolver
			base = path.resolve(imp);
		} else {
			// alias (@...) → unified resolver (config + cache + glob)
			base = await resolveAliasPath(imp, ROOT, getConfig());
		}

		if (!base) continue;

		const absBase = path.resolve(base);
		expected.add(absBase);

		const resolvedPath = await tryResolveImport(absBase);
		if (!resolvedPath) continue;

		resolved.add(absBase);
		files.push(resolvedPath);

		// Recursive traversal
		const sub = await resolveJsImports({
			filePath: resolvedPath,
			visited,
			depth: depth + 1,
			maxDepth: limitDepth,
		});

		files.push(...sub.files);
		for (const e of sub.stats.expected) expected.add(e);
		for (const r of sub.stats.resolved) resolved.add(r);
	}

	const uniqueFiles = unique(files);
	const diff = setDiff(expected, resolved);

	logger.debug(`🪶 [js-resolver] ${filePath} → expected: ${expected.size}, resolved: ${resolved.size}`);
	if (diff.size) logger.debug([...diff], "🔴 THE diff");

	return { files: uniqueFiles, visited, stats: { expected, resolved } };
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
