import path from "path";
import { BASE_EXTS, DTS_EXT, REAL_EXTS } from "../resolver-constants";
import { CACHE_KEYS } from "../../cache/cache-keys";
import { safeStatCached } from "../../filesystem/stat-cache";
import { logger } from "../../diagnostics/logger";
import { CacheManager } from "../../cache/cache-manager";
import { readFileSafe } from "../../filesystem/read-file";
import { isExcluded } from "../../tracing/exclude";
import { emptyResult, mergeStats, newStats, setDiff, unique } from "../../tracing/trace-stats";
import type { ResolverParams, ResolverResult } from "../../types";
import { extractImports } from "./extract-imports";
import { resolveAliasPath } from "./resolve-alias";

const { JS_STATS, JS_IMPORTS } = CACHE_KEYS;

export async function resolveJsImports({
	cfg,
	filePath,
	visited = new Set(),
	depth = 0,
	maxDepth,
}: ResolverParams): Promise<ResolverResult> {
	const limitDepth = maxDepth ?? cfg.resolve.maxDepth;

	if (depth >= limitDepth) return emptyResult(visited);
	if (visited.has(filePath)) return emptyResult(visited);
	visited.add(filePath);

	const ext = path.extname(filePath).toLowerCase();
	const isDts = ext === DTS_EXT;
	if (!BASE_EXTS.includes(ext) && !isDts) return emptyResult(visited);

	const code = readFileSafe(filePath);
	if (!code) return emptyResult(visited);

	const imports = await getImportsCached(filePath, code);
	if (!imports.size) return emptyResult(visited);

	const stats = newStats();
	const files: string[] = [];

	for (const imp of imports) {
		if (!imp.startsWith(".") && !imp.startsWith("/") && !imp.startsWith("@")) continue;
		if (isExcluded(imp, cfg.exclude, cfg.root)) continue;

		const base = await resolveImportBase(imp, filePath, cfg.root, cfg);
		if (!base) continue;

		const absBase = path.resolve(base);
		if (isExcluded(absBase, cfg.exclude, cfg.root)) continue;

		const resolvedPath = await tryResolveImport(absBase);
		if (isExcluded(resolvedPath, cfg.exclude, cfg.root)) continue;

		stats.expected.add(absBase);
		if (!resolvedPath) continue;

		stats.resolved.add(absBase);
		files.push(resolvedPath);

		const nested = await resolveJsImports({
			cfg,
			filePath: resolvedPath,
			visited,
			depth: depth + 1,
			maxDepth: limitDepth,
		});

		files.push(...nested.files);
		mergeStats(stats, nested.stats);
	}

	const unresolved = setDiff(stats.expected, stats.resolved);
	logger.debug(`[js-resolver] ${filePath} -> expected: ${stats.expected.size}, resolved: ${stats.resolved.size}`);
	if (unresolved.size) logger.debug("[js-resolver] unresolved:", [...unresolved]);

	return { files: unique(files), visited, stats };
}

async function resolveImportBase(
	imp: string,
	filePath: string,
	root: string,
	cfg: ResolverParams["cfg"],
): Promise<string | null> {
	if (imp.startsWith(".")) return path.resolve(path.dirname(filePath), imp);
	if (imp.startsWith("/")) return path.resolve(imp);
	return resolveAliasPath(imp, root, cfg);
}

async function tryResolveImport(basePath: string): Promise<string | null> {
	const candidates: string[] = [];
	const ext = path.extname(basePath).toLowerCase();

	if (ext && REAL_EXTS.has(ext)) {
		candidates.push(basePath);
	} else {
		for (const candidateExt of [...BASE_EXTS, DTS_EXT]) {
			candidates.push(basePath + candidateExt);
			candidates.push(path.join(basePath, "index" + candidateExt));
		}
	}

	const results = await Promise.allSettled(
		candidates.map(async (candidate) => {
			const abs = path.resolve(candidate);
			const stats = await safeStatCached(JS_STATS, abs);
			return stats?.isFile() ? abs : null;
		}),
	);

	return results.find(isFulfilledPath)?.value ?? null;
}

async function getImportsCached(filePath: string, code: string): Promise<Set<string>> {
	const cached = CacheManager.get(JS_IMPORTS, filePath);
	if (cached) return cached;

	const imports = await extractImports(filePath, code);
	CacheManager.set(JS_IMPORTS, filePath, imports);
	return imports;
}

function isFulfilledPath(result: PromiseSettledResult<string | null>): result is PromiseFulfilledResult<string> {
	return result.status === "fulfilled" && !!result.value;
}
