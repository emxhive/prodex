import type { ResolverResult } from "../types";

export function newResolverStats(): ResolverResult["stats"] {
	return { expected: new Set(), resolved: new Set() };
}

export function emptyResolverResult(): ResolverResult {
	return { files: [], stats: newResolverStats() };
}

export function resolverSetDiff<A>(left: Set<A>, right: Set<A>): Set<A> {
	return new Set([...left].filter((item) => !right.has(item)));
}

export function uniqueResolvedFiles(files: string[]): string[] {
	return [...new Set(files)];
}
