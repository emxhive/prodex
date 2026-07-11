import { builtinModules } from "node:module";
import { ResolutionRequest } from "../../request/types";
import { WorkspaceIndex } from "../../workspace";
import { OwnershipManifestCache } from "../manifest-cache";
import { parsePackageSpecifierRoot } from "../specifier-root";
import { DependencyOwnershipResult } from "../types";

const NODE_BUILTINS = new Set<string>([
	...builtinModules,
	...builtinModules.map((name) => name.startsWith("node:") ? name.slice("node:".length) : name)
]);

/**
 * Authoritative check: is this request a JS/TS package-ownership candidate?
 *
 * Two paths, sharing a common package-candidate tail:
 *
 * Explicit-semantics path (request.semantics is set):
 *   - intent must be 'dependency-edge'
 *   - JS/TS ecosystem must be evidenced by language id or profile
 *     (syntaxKind alone is not sufficient when semantics are present)
 *   - semantic ownership applicability: domain must be 'module',
 *     resolution must be 'logical' (relative and absolute go to path pipeline)
 *
 * Compatibility path (no request.semantics):
 *   - intent must be 'dependency-edge'
 *   - JS/TS evidenced by language id OR syntaxKind
 *     (syntaxKind alone is permitted here for legacy callers)
 *
 * Both paths then apply the shared package-candidate specifier exclusions.
 */
export function isJsTsOwnershipCandidate(request: ResolutionRequest): boolean {
	// 1. Intent is always required
	if (request.intent !== 'dependency-edge') return false;

	const lang = request.sourceLanguage ?? request.profile?.languageId;
	const isJsTsLanguage = lang === 'javascript' || lang === 'typescript' || lang === 'tsx';

	if (request.semantics) {
		// --- Explicit-semantics path ---
		// Ecosystem must come from language evidence only; syntaxKind is not accepted
		if (!isJsTsLanguage) return false;

		// Semantic ownership applicability: only module + logical reaches ownership
		if (request.semantics.domain !== 'module') return false;
		if (request.semantics.resolution !== 'logical') return false;
		// (relative and absolute are path-addressed; they must not enter ownership)
	} else {
		// --- Compatibility path ---
		// Language OR syntaxKind may establish JS/TS eligibility
		const isJsTsSyntax =
			request.syntaxKind === 'esm-import' || request.syntaxKind === 'commonjs-require';
		if (!isJsTsLanguage && !isJsTsSyntax) return false;
	}

	// 2. Shared package-candidate specifier exclusions (both paths)
	const specifier = request.specifier.trim();
	if (!specifier) return false;
	if (specifier.startsWith('require(') || specifier.startsWith('import(')) return false;
	if (specifier.startsWith('#') || specifier.startsWith('@/') || specifier.startsWith('~/')) return false;
	if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('\\')) return false;
	if (/^[a-zA-Z]:[\\/]/.test(specifier)) return false;
	if (/^(https?|ftp|file):\/\//.test(specifier)) return false;
	if (specifier.includes('${')) return false;
	return !!parsePackageSpecifierRoot(specifier);
}

/**
 * Compatibility alias. Preserved for any callers outside the ownership
 * pipeline that depend on this export. Semantically equivalent to
 * isJsTsOwnershipCandidate for requests without explicit semantics.
 *
 * New code should call isJsTsOwnershipCandidate directly.
 */
export function isJsTsBareDependencyEdge(request: ResolutionRequest): boolean {
	return isJsTsOwnershipCandidate(request);
}

export function classifyJsTsOwnership(
	request: ResolutionRequest,
	index: WorkspaceIndex,
	manifestCache: OwnershipManifestCache
): DependencyOwnershipResult {
	const specifier = request.specifier.trim();
	const specifierRoot = parsePackageSpecifierRoot(specifier);
	const ecosystem = request.sourceLanguage === "javascript" ? "javascript" : "typescript";

	if (!specifierRoot) {
		return {
			kind: "unresolved",
			reason: "unsupported",
			ecosystem,
			specifier,
			sourceFile: request.sourceFile,
			message: `JS/TS ownership could not parse a package root for "${specifier}".`
		};
	}

	const builtinName = specifier.startsWith("node:") ? specifier.slice("node:".length) : specifier;
	if (specifier.startsWith("node:") || NODE_BUILTINS.has(builtinName) || NODE_BUILTINS.has(specifierRoot)) {
		return {
			kind: "external",
			reason: "platform-builtin",
			ecosystem,
			specifier,
			specifierRoot,
			sourceFile: request.sourceFile,
			evidence: {
				platform: "node",
				builtin: builtinName
			},
			message: `Specifier "${specifier}" is a platform builtin.`
		};
	}

	const readErrors = manifestCache.getReadErrors(index);
	const localPackage = manifestCache.findLocalPackageByName(index, specifierRoot);
	if (localPackage) {
		return {
			kind: "local",
			reason: "project-owned",
			ecosystem,
			specifier,
			specifierRoot,
			sourceFile: request.sourceFile,
			evidence: {
				manifestPath: localPackage.path,
				packageRoot: localPackage.root,
				packageName: localPackage.name
			},
			message: `Specifier "${specifier}" matches local package "${specifierRoot}".`
		};
	}

	const nearestManifest = manifestCache.findNearestManifestForSource(index, request.sourceFile);
	if (nearestManifest?.dependencyNames.has(specifierRoot)) {
		return {
			kind: "external",
			reason: "declared-external",
			ecosystem,
			specifier,
			specifierRoot,
			sourceFile: request.sourceFile,
			evidence: {
				manifestPath: nearestManifest.path,
				packageName: nearestManifest.name,
				dependencyName: specifierRoot
			},
			message: `Specifier "${specifier}" is declared as an external dependency.`
		};
	}

	if (!nearestManifest && readErrors.length > 0) {
		return {
			kind: "unresolved",
			reason: "unknown",
			ecosystem,
			specifier,
			specifierRoot,
			sourceFile: request.sourceFile,
			evidence: {
				readErrors
			},
			message: `Could not inspect JS/TS manifest evidence for "${specifier}".`
		};
	}

	return {
		kind: "unresolved",
		reason: "undeclared",
		ecosystem,
		specifier,
		specifierRoot,
		sourceFile: request.sourceFile,
		evidence: nearestManifest
			? {
				manifestPath: nearestManifest.path,
				packageName: nearestManifest.name
			}
			: {
				manifestPath: undefined
			},
		message: `Specifier "${specifier}" is not declared and does not match a local package.`
	};
}
