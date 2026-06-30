import path from "node:path";
import { normalizePath } from "../../../filesystem/path";
import { ResolutionRequest, ResolutionResult } from "../../request/types";
import { SpecifierClassification, classifySpecifier, resolveRequestBasePath } from "../classify";
import { StrategyOutcome } from "../types";
import { WorkspaceIndex } from "../../workspace";
import { DebugCollector } from "../../debug/collector";
import { ConfigCache } from "../config-cache";
import { resolveBoundary } from "./boundary";
import { resolveExactPath } from "./exact-path";
import { resolveSourceEquivSibling } from "./source-equiv-sibling";
import { resolveCallerPriorityExt } from "./caller-priority-ext";
import { resolveWorkspaceExtFallback } from "./workspace-ext-fallback";
import { resolveDirectoryEntry } from "./directory-entry";

/**
 * Checks if a specifier matches an alias or path pattern key.
 * Boundary-aware for directory structures.
 */
export function isPatternMatch(specifier: string, key: string): boolean {
	if (key.includes("*")) {
		const parts = key.split("*");
		if (parts.length === 2) {
			const prefix = parts[0];
			const suffix = parts[1];
			return specifier.startsWith(prefix) && specifier.endsWith(suffix) && specifier.length >= prefix.length + suffix.length;
		}
		return false;
	}

	if (specifier === key) {
		return true;
	}

	if (key.endsWith("/") || key.endsWith("\\")) {
		return specifier.startsWith(key);
	}

	if (specifier.startsWith(key)) {
		const nextChar = specifier[key.length];
		return nextChar === "/" || nextChar === "\\";
	}

	return false;
}

/**
 * Boundary-aware alias matching utility.
 * Supports exact match, trailing slash prefix matching, and wildcard matching (*).
 */
export function matchAliasPattern(specifier: string, key: string, replacement: string): string | null {
	// Case 1: Wildcard matching e.g. "@/*" -> "src/*"
	if (key.includes("*")) {
		const keyParts = key.split("*");
		const repParts = replacement.split("*");
		if (keyParts.length === 2 && repParts.length === 2) {
			const prefix = keyParts[0];
			const suffix = keyParts[1];
			if (specifier.startsWith(prefix) && specifier.endsWith(suffix) && specifier.length >= prefix.length + suffix.length) {
				const wildcardVal = specifier.slice(prefix.length, specifier.length - suffix.length);
				return repParts[0] + wildcardVal + repParts[1];
			}
		}
		return null;
	}

	// Case 2: Exact matching
	if (specifier === key) {
		return replacement;
	}

	// Case 3: Boundary-aware prefix matching
	if (key.endsWith("/") || key.endsWith("\\")) {
		if (specifier.startsWith(key)) {
			return replacement + specifier.slice(key.length);
		}
	} else {
		if (specifier.startsWith(key)) {
			const nextChar = specifier[key.length];
			if (nextChar === "/" || nextChar === "\\") {
				return replacement + specifier.slice(key.length);
			}
		}
	}

	return null;
}

/**
 * Walks upward from the sourceFile directory to the index.root looking for tsconfig.json / jsconfig.json
 */
export function findNearestConfig(
	sourceFile: string,
	index: WorkspaceIndex,
	configName: "tsconfig.json" | "jsconfig.json"
): string | null {
	let dir = normalizePath(path.dirname(sourceFile));
	const root = index.root;

	while (true) {
		const configPath = normalizePath(path.join(dir, configName));
		if (index.filesByAbsolute.has(configPath)) {
			return configPath;
		}
		if (dir === root || dir === path.dirname(dir)) {
			break;
		}
		dir = normalizePath(path.dirname(dir));
	}

	// Fallback to root config if present in index
	const rootConfigPath = normalizePath(path.join(root, configName));
	if (index.filesByAbsolute.has(rootConfigPath)) {
		return rootConfigPath;
	}
	return null;
}

/**
 * Runs a candidate path-like target through the path resolution pipeline.
 */
function resolveCandidatePath(
	candidatePath: string,
	request: ResolutionRequest,
	classification: SpecifierClassification,
	index: WorkspaceIndex,
	debugCollector?: DebugCollector
): ResolutionResult | null {
	const tempClassification = classifySpecifier({ ...request, specifier: candidatePath }, debugCollector);

	// L2: Boundary enforcement
	const l2Outcome = resolveBoundary(
		{ ...request, specifier: candidatePath },
		tempClassification,
		index,
		debugCollector
	);
	if (l2Outcome.type === "final") {
		return l2Outcome.result;
	}

	// L3: Exact path
	const l3Outcome = resolveExactPath(
		{ ...request, specifier: candidatePath },
		tempClassification,
		index,
		debugCollector
	);
	if (l3Outcome.type === "final") return l3Outcome.result;

	// L3.5: Source equivalent sibling
	const l35Outcome = resolveSourceEquivSibling(
		{ ...request, specifier: candidatePath },
		tempClassification,
		index,
		debugCollector
	);
	if (l35Outcome.type === "final") return l35Outcome.result;

	// L4: Caller priority extension
	const l4Outcome = resolveCallerPriorityExt(
		{ ...request, specifier: candidatePath },
		tempClassification,
		index,
		debugCollector
	);
	if (l4Outcome.type === "final") return l4Outcome.result;

	// L5: Workspace extension fallback
	const l5Outcome = resolveWorkspaceExtFallback(
		{ ...request, specifier: candidatePath },
		tempClassification,
		index,
		debugCollector
	);
	if (l5Outcome.type === "final") return l5Outcome.result;

	// L6: Directory entry
	const l6Outcome = resolveDirectoryEntry(
		{ ...request, specifier: candidatePath },
		tempClassification,
		index,
		debugCollector
	);
	if (l6Outcome.type === "final") return l6Outcome.result;

	return null;
}

/**
 * L8 Resolution strategy for tsconfig/jsconfig paths, baseUrl, and prodex.json aliases.
 */
export function resolveTsConfigPaths(
	request: ResolutionRequest,
	classification: SpecifierClassification,
	index: WorkspaceIndex,
	configCache: ConfigCache,
	debugCollector?: DebugCollector,
	visitedRewrites = new Set<string>(),
	depth = 0
): StrategyOutcome {
	const specifier = request.specifier.trim();

	// Ignore normal relative path specifiers like ./x, ../x, and /x
	const isRelativeOrAbsolute =
		specifier.startsWith("./") ||
		specifier.startsWith("../") ||
		specifier.startsWith("/") ||
		specifier.startsWith("\\") ||
		/^[a-zA-Z]:[\\\/]/.test(specifier);

	if (isRelativeOrAbsolute) {
		return { type: "no-decision", reason: "Relative or absolute path specifier ignored by L8." };
	}

	if (depth >= 5) {
		return {
			type: "final",
			result: {
				status: "unresolved",
				level: "L8",
				strategy: "tsconfig-paths",
				reason: `Exceeded alias rewrite recursion depth limit of 5. Specifier: ${specifier}`
			}
		};
	}

	if (visitedRewrites.has(specifier)) {
		return {
			type: "final",
			result: {
				status: "unresolved",
				level: "L8",
				strategy: "tsconfig-paths",
				reason: `Circular alias rewrite loop detected: ${Array.from(visitedRewrites).join(" -> ")} -> ${specifier}`
			}
		};
	}

	visitedRewrites.add(specifier);

	try {
		// 1. Precedence 1: prodex.json aliases
		if (request.aliases) {
			const matchedKeys: Array<{ key: string }> = [];
			for (const key of Object.keys(request.aliases)) {
				if (isPatternMatch(specifier, key)) {
					matchedKeys.push({ key });
				}
			}

			if (matchedKeys.length > 0) {
				matchedKeys.sort((a, b) => b.key.length - a.key.length);

				for (const { key } of matchedKeys) {
					const target = request.aliases[key];
					const resolvedTarget = normalizePath(path.resolve(index.root, target));
					const rewrittenTarget = matchAliasPattern(specifier, key, resolvedTarget);

					if (rewrittenTarget) {
						const resolved = resolveCandidatePath(rewrittenTarget, request, classification, index, debugCollector);
						if (resolved) {
							return {
								type: "final",
								result: {
									...resolved,
									level: "L8",
									strategy: "prodex-alias",
									attempted: [rewrittenTarget, ...(resolved.attempted || [])]
								}
							};
						}

						// If matched a prodex.json alias but target cannot be resolved, return unresolved
						return {
							type: "final",
							result: {
								status: "unresolved",
								level: "L8",
								strategy: "prodex-alias",
								reason: `Mapped prodex.json alias "${key}" target "${target}" could not be resolved.`,
								attempted: [rewrittenTarget]
							}
						};
					}
				}
			}
		}

		// 2. Precedence 2: nearest tsconfig.json / jsconfig.json
		const baseFile = resolveRequestBasePath(request, index);
		if (baseFile) {
			let configPath = findNearestConfig(baseFile, index, "tsconfig.json");
			if (!configPath) {
				configPath = findNearestConfig(baseFile, index, "jsconfig.json");
			}

			if (configPath) {
				const parsedConfig = configCache.getParsedTsConfig(configPath);
				
				// A. Match compilerOptions.paths
				if (parsedConfig.paths) {
					const matchedKeys: Array<{ key: string }> = [];
					for (const key of Object.keys(parsedConfig.paths)) {
						if (isPatternMatch(specifier, key)) {
							matchedKeys.push({ key });
						}
					}

					if (matchedKeys.length > 0) {
						matchedKeys.sort((a, b) => b.key.length - a.key.length);

						for (const { key } of matchedKeys) {
							const targets = parsedConfig.paths[key] || [];
							const attemptedTargets: string[] = [];
							let hasL2Blocked: ResolutionResult | null = null;

							for (const target of targets) {
								const rewrittenTarget = matchAliasPattern(specifier, key, target);
								if (!rewrittenTarget) continue;

								attemptedTargets.push(rewrittenTarget);

								// If the target is not a path-like specifier, recursively run L8 resolution
								const isTargetRelativeOrAbsolute =
									rewrittenTarget.startsWith("./") ||
									rewrittenTarget.startsWith("../") ||
									rewrittenTarget.startsWith("/") ||
									rewrittenTarget.startsWith("\\") ||
									/^[a-zA-Z]:[\\\/]/.test(rewrittenTarget);

								if (!isTargetRelativeOrAbsolute) {
									const recOutcome = resolveTsConfigPaths(
										{ ...request, specifier: rewrittenTarget },
										classification,
										index,
										configCache,
										debugCollector,
										visitedRewrites,
										depth + 1
									);
									if (recOutcome.type === "final") {
										return {
											type: "final",
											result: {
												...recOutcome.result,
												level: "L8",
												strategy: "tsconfig-paths"
											}
										};
									}
									continue;
								}

								// Target is path-like, resolve it
								const resolved = resolveCandidatePath(rewrittenTarget, request, classification, index, debugCollector);
								if (resolved) {
									if (resolved.status === "blocked") {
										hasL2Blocked = resolved;
										continue;
									}
									return {
										type: "final",
										result: {
											...resolved,
											level: "L8",
											strategy: "tsconfig-paths",
											attempted: [...attemptedTargets, ...(resolved.attempted || [])]
										}
									};
								}
							}

							if (hasL2Blocked) {
								return {
									type: "final",
									result: {
										...hasL2Blocked,
										level: "L8",
										strategy: "tsconfig-paths"
									}
								};
							}

							// If we matched the path pattern but couldn't find any file, report it as unresolved
							return {
								type: "final",
								result: {
									status: "unresolved",
									level: "L8",
									strategy: "tsconfig-paths",
									reason: `Mapped path alias "${key}" targets could not be resolved: ${targets.join(", ")}`,
									attempted: attemptedTargets
								}
							};
						}
					}
				}

				// B. Match baseUrl
				if (parsedConfig.baseUrl) {
					const candidateBaseUrlPath = normalizePath(path.resolve(parsedConfig.baseUrl, specifier));
					const resolved = resolveCandidatePath(candidateBaseUrlPath, request, classification, index, debugCollector);
					if (resolved) {
						if (resolved.status === "blocked") {
							return {
								type: "final",
								result: {
									...resolved,
									level: "L8",
									strategy: "tsconfig-paths"
								}
							};
						}
						return {
							type: "final",
							result: {
								...resolved,
								level: "L8",
								strategy: "tsconfig-paths",
								attempted: [candidateBaseUrlPath, ...(resolved.attempted || [])]
							}
						};
					}
					// If baseUrl target doesn't exist, we fall through so bare external check can resolve it as external
				}
			}
		}
	} finally {
		visitedRewrites.delete(specifier);
	}

	return { type: "no-decision", reason: "Specifier did not match any local aliases or path configs." };
}
