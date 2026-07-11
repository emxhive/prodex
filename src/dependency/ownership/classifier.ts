import { ResolutionRequest } from "../request/types";
import { WorkspaceIndex } from "../workspace";
import { OwnershipManifestCache } from "./manifest-cache";
import { classifyJsTsOwnership, isJsTsOwnershipCandidate } from "./ecosystems/js-ts";
import { DependencyOwnershipResult } from "./types";

export function shouldRunOwnershipGate(request: ResolutionRequest): boolean {
	return isJsTsOwnershipCandidate(request);
}

export function classifyOwnership(
	request: ResolutionRequest,
	index: WorkspaceIndex,
	manifestCache: OwnershipManifestCache
): DependencyOwnershipResult {
	if (isJsTsOwnershipCandidate(request)) {
		return classifyJsTsOwnership(request, index, manifestCache);
	}

	return {
		kind: "unresolved",
		reason: "unsupported",
		ecosystem: request.sourceLanguage ?? request.profile?.languageId ?? "unknown",
		specifier: request.specifier,
		sourceFile: request.sourceFile,
		message: `No ownership classifier is available for "${request.specifier}".`
	};
}
