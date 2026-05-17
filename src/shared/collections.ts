import type { ResolverResult } from "../types/resolver.types";

export function newStats(): ResolverResult["stats"] {
	return { expected: new Set(), resolved: new Set() };
}

export function mergeStats(target, src) {
	src.expected.forEach((i) => target.expected.add(i));
	src.resolved.forEach((i) => target.resolved.add(i));
	return target;
}

/**
 * Returns a new Set of elements present in A but not in B.
 * Used to detect unresolved imports in JS and PHP resolvers.
 */
export function setDiff<A>(A: Set<A>, B: Set<A>): Set<A> {
	return new Set([...A].filter((x) => !B.has(x)));
}
/**
 * Removes duplicates from an array.
 * Stateless helper used across resolvers and dependency chain.  
 */

export function unique<T>(arr: T[]): T[] {
	return [...new Set(arr)];
}
/** Empty result helper */
export function emptyResult(visited: Set<string>): ResolverResult {
	return { files: [], visited, stats: { expected: new Set(), resolved: new Set() } };
} // ---------------------------------------------------------


