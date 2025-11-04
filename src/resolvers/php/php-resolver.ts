import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import micromatch from "micromatch";
import { extractPhpImports, expandGroupedUses } from "./patterns";
import { loadLaravelBindings } from "./bindings";
import { resolvePsr4 } from "./psr4";
import { logger } from "../../lib/logger";
import { newStats, mergeStats, emptyStats } from "../shared/stats";
import { tryResolvePhpFile } from "../shared/file-cache"; // existing sync helper
import { unique } from "../../lib/utils";
import { getConfig } from "../../store";
import type { ResolverParams, ResolverResult, PhpResolverCtx } from "../../types";

/** Safe async file read (empty string on failure) */
async function readFileSafe(p: string): Promise<string> {
	try {
		return await fsp.readFile(p, "utf8");
	} catch {
		return "";
	}
}

/** Precompiled micromatch exclude matcher */
function makeExcludeMatcher(patterns: string[]) {
	if (!patterns?.length) return () => false;
	const mm = micromatch.matcher(patterns);
	return (s: string) => mm(String(s).replace(/\\/g, "/"));
}

/** Ensure we have a PHP resolver context for the current root */
function buildPhpCtx(root: string, prev?: PhpResolverCtx): PhpResolverCtx {
	if (prev?.kind === "php") return prev;
	const psr4 = resolvePsr4(root);
	const nsKeys = Object.keys(psr4).sort((a, b) => b.length - a.length);
	const bindings = loadLaravelBindings(root);
	return { kind: "php", psr4, nsKeys, bindings };
}

/** Namespace prefix check */
function startsWithAnyNamespace(imp: string, nsKeys: string[]): boolean {
	for (const k of nsKeys) if (imp.startsWith(k)) return true;
	return false;
}

/** Empty result helper */
function empty(visited: Set<string>): ResolverResult {
	return { files: [], visited, stats: emptyStats() };
}

/**
 * Typed PHP resolver (aligned with JS resolver signature).
 * - Uses global config via getConfig()
 * - Returns ResolverResult (files + stats)
 * - Depth/visited guarded recursion
 */
export async function resolvePhpImports({ filePath, visited = new Set<string>(), depth = 0, maxDepth, ctx }: ResolverParams): Promise<ResolverResult> {
	const {
		root: ROOT,
		resolve: { exclude: excludePatterns = [], depth: defaultDepth = 10 },
	} = getConfig();

	const limitDepth = maxDepth ?? defaultDepth;

	if (depth >= limitDepth) return empty(visited);
	if (visited.has(filePath)) return empty(visited);
	visited.add(filePath);

	// Fast existence / read
	if (!fs.existsSync(filePath)) return empty(visited);
	const code = await readFileSafe(filePath);
	if (!code) return empty(visited);

	// Context + exclusions
	const phpCtx = buildPhpCtx(ROOT, ctx as PhpResolverCtx | undefined);
	const isExcluded = makeExcludeMatcher(excludePatterns);

	// Parse imports (expand grouped `use` syntax)
	const raw = extractPhpImports(code);
	const imports = expandGroupedUses(raw);

	// Accumulators
	const stats = newStats();
	const filesOut: string[] = [];

	for (const imp0 of imports) {
		let imp = imp0;

		// Respect Laravel container bindings (Interface → Implementation)
		if (phpCtx.bindings[imp]) {
			logger.debug("[php-resolver] binding:", imp, "→", phpCtx.bindings[imp]);
			imp = phpCtx.bindings[imp];
		}

		// Only resolve PSR-4 mapped namespaces
		if (!startsWithAnyNamespace(imp, phpCtx.nsKeys)) continue;
		if (isExcluded(imp)) continue;

		stats.expected.add(imp);

		// Resolve namespace → file path (sync helper retained)
		const resolvedPath = tryResolvePhpFile(imp, filePath, phpCtx.psr4);
		if (!resolvedPath) continue;

		stats.resolved.add(imp);
		filesOut.push(resolvedPath);

		// Recurse
		const sub = await resolvePhpImports({
			filePath: resolvedPath,
			visited,
			depth: depth + 1,
			maxDepth: limitDepth,
			ctx: phpCtx,
		});

		filesOut.push(...sub.files);
		mergeStats(stats, sub.stats);
	}

	const out = unique(filesOut);
	const unresolved = new Set([...stats.expected].filter((x) => !stats.resolved.has(x)));
	logger.debug(`🪶 [php-resolver] ${path.basename(filePath)} → expected: ${stats.expected.size}, resolved: ${stats.resolved.size}`);
	if (unresolved.size) logger.debug("[php-resolver] unresolved:", [...unresolved]);

	return { files: out, visited, stats };
}
