// File: src/shared/patterns.ts
import micromatch from "micromatch";
import path from "path";
import { cwd } from "process";
import { rel } from ".";

/**
 * Returns true if a given path matches any of the provided glob patterns.
 * Equivalent to core/helpers.isExcluded().
 */
// export function isExcluded(p: string = "", patterns: string[] = [], root = process.cwd()): boolean {
// 	if (!patterns?.length) return false;
// 	if (!p) return false;
// 	const relPath = p.replaceAll("\\", "/");
// 	return micromatch.isMatch(relPath, patterns);
// }


/**
 * Centralized exclusion logic.
 * Accepts namespaces, absolute paths, or relative paths
 * and converts everything to a normalized, root-relative glob target.
 */
export function isExcluded(p: string, patterns: string[] = [], root: string = process.cwd()): boolean {
	if (!patterns?.length) return false;
	if (!p) return false;

	let norm = p.norm();

	if (!path.isAbsolute(norm) && /^[A-Z]/.test(norm)) return false;

	if (path.isAbsolute(norm)) norm = rel(norm, root).norm();

	return micromatch.isMatch(norm, patterns);
}
/**
 * Builds a reusable micromatch matcher for efficiency.
 * Equivalent to php-resolver.makeExcludeMatcher().
 */
export function makeExcludeMatcher(patterns: string[] = []): (s: string) => boolean {
	if (!patterns?.length) return () => false;
	const mm = micromatch.matcher(patterns);
	return (s: string) => mm(String(s).replace(/\\/g, "/"));
}
