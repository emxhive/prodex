// File: src/shared/patterns.ts
import micromatch from "micromatch";
import path from "path";
import { rel } from ".";


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
