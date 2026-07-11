import path from "node:path";
import { normalizePath } from "../../../filesystem/path";
import { DependencyOwnershipResult } from "../../ownership/types";
import { getPackageSubpath } from "../../ownership/specifier-root";
import { ResolutionRequest, ResolutionResult } from "../../request/types";
import { WorkspaceIndex } from "../../workspace";
import { classifySpecifier } from "../classify";
import { resolveBoundary } from "./boundary";
import { resolveExactPath } from "./exact-path";
import { resolveSourceEquivSibling } from "./source-equiv-sibling";
import { resolveCallerPriorityExt } from "./caller-priority-ext";
import { resolveWorkspaceExtFallback } from "./workspace-ext-fallback";
import { resolveDirectoryEntry } from "./directory-entry";
import { DebugCollector } from "../../debug/collector";

export function resolveOwnedPackage(
	request: ResolutionRequest,
	ownership: DependencyOwnershipResult,
	index: WorkspaceIndex,
	debugCollector?: DebugCollector
): ResolutionResult {
	const evidence = ownership.evidence as { packageRoot?: string } | undefined;
	const packageRoot = evidence?.packageRoot ? normalizePath(evidence.packageRoot) : undefined;
	const specifierRoot = ownership.specifierRoot;

	if (!packageRoot || !specifierRoot) {
		return unresolvedOwnedPackage(request, ownership, "Ownership evidence did not include a package root.");
	}

	const subpath = getPackageSubpath(request.specifier, specifierRoot);
	if (subpath.includes("..") || path.isAbsolute(subpath)) {
		return unresolvedOwnedPackage(request, ownership, `Owned package subpath "${subpath}" is outside the supported local package scope.`);
	}

	const candidatePath = normalizePath(path.join(packageRoot, subpath));
	const relativeToPackage = normalizePath(path.relative(packageRoot, candidatePath));
	if (relativeToPackage.startsWith("..") || path.isAbsolute(relativeToPackage)) {
		return unresolvedOwnedPackage(request, ownership, `Owned package candidate "${candidatePath}" escapes package root "${packageRoot}".`);
	}

	const candidateRequest: ResolutionRequest = {
		...request,
		specifier: candidatePath
	};
	const classification = classifySpecifier(candidateRequest, debugCollector);
	const attempted = [candidatePath];

	const strategies = subpath
		? [
			resolveBoundary,
			resolveExactPath,
			resolveSourceEquivSibling,
			resolveCallerPriorityExt,
			resolveWorkspaceExtFallback,
			resolveDirectoryEntry
		]
		: [
			resolveBoundary,
			resolveDirectoryEntry
		];

	for (const strategy of strategies) {
		const outcome = strategy(candidateRequest, classification, index, debugCollector);
		if (outcome.type === "final") {
			const escapingPath = getEscapingOwnedPackageResultPath(outcome.result, packageRoot);
			if (escapingPath) {
				return unresolvedOwnedPackage(
					request,
					ownership,
					`Project-owned package resolution for "${request.specifier}" escaped package root "${packageRoot}" via "${escapingPath}".`,
					[...attempted, ...(outcome.result.attempted || [])]
				);
			}

			return {
				...outcome.result,
				level: "L1",
				strategy: "ownership-local",
				ownership,
				attempted: [...attempted, ...(outcome.result.attempted || [])]
			};
		}
	}

	return unresolvedOwnedPackage(
		request,
		ownership,
		subpath
			? `Project-owned package subpath "${request.specifier}" could not be resolved under "${packageRoot}".`
			: `Project-owned package "${request.specifier}" did not resolve to an index file under "${packageRoot}".`,
		attempted
	);
}

function unresolvedOwnedPackage(
	request: ResolutionRequest,
	ownership: DependencyOwnershipResult,
	reason: string,
	attempted: string[] = []
): ResolutionResult {
	return {
		status: "unresolved",
		level: "L1",
		strategy: "ownership-local",
		reason,
		attempted,
		ownership: {
			kind: "unresolved",
			reason: "unknown",
			ecosystem: ownership.ecosystem,
			specifier: request.specifier,
			specifierRoot: ownership.specifierRoot,
			sourceFile: request.sourceFile,
			evidence: {
				projectOwned: ownership.evidence,
				attempted
			},
			message: reason
		}
	};
}

function getEscapingOwnedPackageResultPath(result: ResolutionResult, packageRoot: string): string | undefined {
	for (const candidate of [
		...(result.file ? [result.file] : []),
		...(result.files || []),
		...(result.candidates || []),
		...(result.attempted || [])
	]) {
		if (!isRelevantPath(candidate)) continue;
		if (!isInsidePackageRoot(candidate, packageRoot)) return normalizePath(candidate);
	}
	return undefined;
}

function isRelevantPath(value: string): boolean {
	return path.isAbsolute(value) || /^[a-zA-Z]:[\\\/]/.test(value);
}

function isInsidePackageRoot(candidate: string, packageRoot: string): boolean {
	const normalizedCandidate = normalizePath(path.resolve(candidate));
	const normalizedPackageRoot = normalizePath(path.resolve(packageRoot));
	const relative = normalizePath(path.relative(normalizedPackageRoot, normalizedCandidate));
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
