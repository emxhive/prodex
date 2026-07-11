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

export function isJsTsBareDependencyEdge(request: ResolutionRequest): boolean {
	if (request.intent !== "dependency-edge") return false;

	const sourceLanguage = request.sourceLanguage ?? request.profile?.languageId;
	const isJsTsLanguage =
		sourceLanguage === "javascript" ||
		sourceLanguage === "typescript" ||
		sourceLanguage === "tsx";
	const isJsTsSyntax =
		request.syntaxKind === "esm-import" ||
		request.syntaxKind === "commonjs-require";

	if (!isJsTsLanguage && !isJsTsSyntax) return false;

	const specifier = request.specifier.trim();
	if (!specifier) return false;
	if (specifier.startsWith("require(") || specifier.startsWith("import(")) return false;
	if (specifier.startsWith("#") || specifier.startsWith("@/") || specifier.startsWith("~/")) return false;
	if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("\\")) return false;
	if (/^[a-zA-Z]:[\\\/]/.test(specifier)) return false;
	if (/^(https?|ftp|file):\/\//.test(specifier)) return false;
	if (specifier.includes("${")) return false;
	return !!parsePackageSpecifierRoot(specifier);
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
