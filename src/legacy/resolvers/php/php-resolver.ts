import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { CACHE_KEYS } from "../../../cache/cache-keys";
import { CacheManager } from "../../../cache/cache-manager";
import { logger } from "../../../diagnostics/logger";
import { normalizePath } from "../../../filesystem/path";
import { readFileSafe } from "../../../filesystem/read-file";
import { emptyResolverResult, newResolverStats, resolverSetDiff, uniqueResolvedFiles } from "../resolver-result";
import type { PhpResolverCtx, ResolverParams, ResolverResult } from "../../../types";
import { loadLaravelBindings } from "./bindings";
import { extractPhpUseMap, extractPhpReferences, resolvePhpReference } from "./extract-imports";
import { resolvePsr4 } from "./psr4";

export async function resolvePhpImports({ cfg, filePath, ctx }: ResolverParams): Promise<ResolverResult> {
	if (!fs.existsSync(filePath)) return emptyResolverResult();
	const code = readFileSafe(filePath);
	if (!code) return emptyResolverResult();

	const currentNamespace = getCurrentNamespace(code);
	const phpCtx = buildPhpCtx(cfg.root, ctx as PhpResolverCtx | undefined);

	const useMap = extractPhpUseMap(code);
	const rawReferences = extractPhpReferences(code);
	const candidateImports = new Set<string>();

	for (const fqcn of Object.values(useMap)) {
		candidateImports.add(fqcn);
	}

	for (const ref of rawReferences) {
		const resolvedRef = resolvePhpReference(ref, currentNamespace, useMap, phpCtx);
		if (resolvedRef) {
			candidateImports.add(resolvedRef);
		}
	}

	const stats = newResolverStats();
	const files: string[] = [];

	for (const resolvedImport of candidateImports) {
		const isFilePath = resolvedImport.startsWith(".") || resolvedImport.includes("/") || resolvedImport.endsWith(".php");
		const matchesNamespace = startsWithAnyNamespace(resolvedImport, phpCtx.nsKeys);
		if (!isFilePath && !matchesNamespace) {
			continue;
		}

		const resolvedPath = await tryResolvePhpFile(resolvedImport, filePath, phpCtx.psr4);
		stats.expected.add(resolvedImport);
		if (!resolvedPath) continue;

		stats.resolved.add(resolvedImport);
		files.push(resolvedPath);
	}

	const unresolved = resolverSetDiff(stats.expected, stats.resolved);
	logger.debug(`[php-resolver] ${path.basename(filePath)} -> expected: ${stats.expected.size}, resolved: ${stats.resolved.size}`);
	if (unresolved.size) logger.debug("[php-resolver] unresolved:", [...unresolved]);

	return { files: uniqueResolvedFiles(files), stats };
}

function getCurrentNamespace(code: string): string | null {
	const nsMatch = code.match(/\bnamespace\s+([^;]+);/);
	return nsMatch ? nsMatch[1].trim() : null;
}

async function tryResolvePhpFile(imp: string, fromFile: string, psr4: Record<string, string | string[]>): Promise<string | null> {
	const key = `php:${imp}:${fromFile}`;
	const cached = CacheManager.get(CACHE_KEYS.PHP_FILECACHE, key);
	if (cached !== undefined) return cached;

	if (imp.startsWith(".") || imp.includes("/") || imp.endsWith(".php")) {
		const absolutePath = path.resolve(path.dirname(fromFile), imp);
		try {
			const stats = await fsp.stat(absolutePath);
			if (stats.isFile()) {
				const resolved = path.resolve(absolutePath);
				CacheManager.set(CACHE_KEYS.PHP_FILECACHE, key, resolved);
				return resolved;
			}
		} catch {}
		if (!imp.endsWith(".php")) {
			try {
				const stats = await fsp.stat(absolutePath + ".php");
				if (stats.isFile()) {
					const resolved = path.resolve(absolutePath + ".php");
					CacheManager.set(CACHE_KEYS.PHP_FILECACHE, key, resolved);
					return resolved;
				}
			} catch {}
		}
		CacheManager.set(CACHE_KEYS.PHP_FILECACHE, key, null);
		return null;
	}

	const nsKey = Object.keys(psr4).find((candidate) => {
		return imp === candidate || imp.startsWith(candidate + "\\");
	});

	if (!nsKey) {
		CacheManager.set(CACHE_KEYS.PHP_FILECACHE, key, null);
		return null;
	}

	const relativeImport = normalizePath(imp.slice(nsKey.length).replace(/^\\+/, ""));
	const mappedDirs = psr4[nsKey];
	const dirs = Array.isArray(mappedDirs) ? mappedDirs : [mappedDirs];

	const candidates: string[] = [];
	for (const dir of dirs) {
		candidates.push(
			path.join(dir, relativeImport),
			path.join(dir, relativeImport + ".php"),
			path.join(dir, relativeImport, "index.php"),
		);
	}

	const results = await Promise.allSettled(
		candidates.map(async (candidate) => {
			try {
				const stats = await fsp.stat(candidate);
				return stats.isFile() ? path.resolve(candidate) : null;
			} catch {
				return null;
			}
		}),
	);

	const resolved = results.find(isFulfilledPath)?.value ?? null;
	CacheManager.set(CACHE_KEYS.PHP_FILECACHE, key, resolved);
	return resolved;
}

function buildPhpCtx(root: string, prev?: PhpResolverCtx): PhpResolverCtx {
	if (prev?.kind === "php") return prev;
	const psr4 = resolvePsr4(root);
	const nsKeys = Object.keys(psr4).sort((a, b) => b.length - a.length);
	const bindings = loadLaravelBindings(root);
	return { kind: "php", psr4, nsKeys, bindings };
}

function startsWithAnyNamespace(imp: string, nsKeys: string[]): boolean {
	for (const nsKey of nsKeys) {
		if (imp === nsKey || imp.startsWith(nsKey + "\\")) return true;
	}
	return false;
}

function isFulfilledPath(result: PromiseSettledResult<string | null>): result is PromiseFulfilledResult<string> {
	return result.status === "fulfilled" && !!result.value;
}
