import path from "path";
import { BASE_EXTS, DTS_EXT, REAL_EXTS } from "../resolver-constants";
import { CACHE_KEYS } from "../../cache/cache-keys";
import { safeStatCached } from "../../filesystem/stat-cache";
import { logger } from "../../diagnostics/logger";
import { CacheManager } from "../../cache/cache-manager";
import { readFileSafe } from "../../filesystem/read-file";
import { emptyResolverResult, newResolverStats, resolverSetDiff, uniqueResolvedFiles } from "../resolver-result";
import type { ResolverParams, ResolverResult } from "../../types";
import { extractImports } from "./extract-imports";
import { resolveAliasPath } from "./resolve-alias";

const { JS_STATS, JS_IMPORTS } = CACHE_KEYS;

export async function resolveJsImports({ cfg, filePath }: ResolverParams): Promise<ResolverResult> {
	const ext = path.extname(filePath).toLowerCase();
	const isDts = ext === DTS_EXT;
	if (!BASE_EXTS.includes(ext) && !isDts) return emptyResolverResult();

	const code = readFileSafe(filePath);
	if (!code) return emptyResolverResult();

	const imports = await getImportsCached(filePath, code);
	if (!imports.size) return emptyResolverResult();

	const stats = newResolverStats();
	const files: string[] = [];

	for (const imp of imports) {
		if (!imp.startsWith(".") && !imp.startsWith("/") && !imp.startsWith("@")) continue;

		const base = await resolveImportBase(imp, filePath, cfg.root, cfg);
		if (!base) continue;

		const absBase = path.resolve(base);
		const resolvedPath = await tryResolveImport(absBase);

		stats.expected.add(absBase);
		if (!resolvedPath) continue;

		stats.resolved.add(absBase);
		files.push(resolvedPath);
	}

	const unresolved = resolverSetDiff(stats.expected, stats.resolved);
	logger.debug(`[js-resolver] ${filePath} -> expected: ${stats.expected.size}, resolved: ${stats.resolved.size}`);
	if (unresolved.size) logger.debug("[js-resolver] unresolved:", [...unresolved]);

	return { files: uniqueResolvedFiles(files), stats };
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
