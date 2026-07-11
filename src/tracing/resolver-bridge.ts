import type { ResolverParams, ResolverResult } from "../types";
import { UniversalDependencyProvider } from "../dependency/provider/universal-provider";

let provider: UniversalDependencyProvider | null = null;

/**
 * Lazy initializer and bridge for production UniversalDependencyProvider.
 */
export async function resolveUniversalImports(params: ResolverParams): Promise<ResolverResult> {
	if (!provider) {
		provider = await UniversalDependencyProvider.create();
	}

	const depResult = await provider.resolve({
		root: params.cfg.root,
		filePath: params.filePath,
		exclude: params.cfg.exclude,
		aliases: params.cfg.aliases
	});

	const expected = new Set<string>();
	const resolved = new Set<string>();

	for (const file of depResult.files) {
		expected.add(file);
		resolved.add(file);
	}

	for (const unres of depResult.unresolved) {
		expected.add(unres.specifier);
	}

	return {
		files: depResult.files,
		stats: { expected, resolved },
		ownership: depResult.ownership,
		diagnostics: depResult.diagnostics
	};
}

/**
 * Resets the lazy-loaded provider and clears its workspace index caches.
 * Useful for test suites that execute multiple runs with modified files.
 */
export function resetProviderBridge(): void {
	if (provider) {
		provider.clearCache();
	}
	provider = null;
}
