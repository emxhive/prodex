// File: src/shared/patterns.ts
import micromatch from "micromatch";

/**
 * Returns true if a given path matches any of the provided glob patterns.
 * Equivalent to core/helpers.isExcluded().
 */
export function isExcluded(p: string = "", patterns: string[] = [], root = process.cwd()): boolean {
	if (!patterns?.length) return false;
	if (!p) return false;
	const relPath = p.replaceAll("\\", "/");
	return micromatch.isMatch(relPath, patterns);
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
