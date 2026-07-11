import path from "path";
import { ResolutionRequest } from "../../request/types";
import { SpecifierClassification, resolveRequestBasePath, isStaticPathEligible } from "../classify";
import { StrategyOutcome } from "../types";
import { WorkspaceIndex } from "../../workspace";
import { normalizePath } from "../../../filesystem/path";
import { DebugCollector } from "../../debug/collector";

export function resolveWorkspaceExtFallback(
	request: ResolutionRequest,
	classification: SpecifierClassification,
	index: WorkspaceIndex,
	debugCollector?: DebugCollector
): StrategyOutcome {
	const pathEligible = isStaticPathEligible(request);
	if (pathEligible === false) {
		return { type: 'no-decision', reason: 'Reference semantics are not eligible for static path resolution.' };
	}

	if (classification.type !== 'path') {
		return { type: 'no-decision', reason: 'Not a path specifier.' };
	}

	const specifier = classification.specifier;
	const ext = path.extname(specifier);
	if (ext) {
		return { type: 'no-decision', reason: 'Specifier already has an explicit extension.' };
	}

	const baseFile = resolveRequestBasePath(request, index);
	let resolvedBase: string;

	if (path.isAbsolute(specifier)) {
		resolvedBase = normalizePath(path.resolve(specifier));
	} else if (baseFile) {
		const originDir = path.dirname(baseFile);
		resolvedBase = normalizePath(path.resolve(originDir, specifier));
	} else {
		resolvedBase = normalizePath(path.resolve(index.root, specifier));
	}

	const attempted: string[] = [];
	const foundCandidates: string[] = [];

	for (const candExt of index.extensionsPresent) {
		const candidatePath = normalizePath(`${resolvedBase}${candExt}`);
		attempted.push(candidatePath);
		if (index.filesByAbsolute.has(candidatePath)) {
			foundCandidates.push(candidatePath);
		}
	}

	if (foundCandidates.length === 1) {
		const result = {
			status: 'resolved' as const,
			level: 'L5' as const,
			strategy: 'workspace-ext-fallback',
			confidence: 'low' as const,
			file: foundCandidates[0],
			files: [foundCandidates[0]],
			attempted
		};
		debugCollector?.emit('resolve:strategy:complete', { strategy: 'L5', request, result }, `L5 Resolved extensionless via workspace extension fallback: ${foundCandidates[0]}`);
		return { type: 'final', result };
	}

	if (foundCandidates.length > 1) {
		const result = {
			status: 'ambiguous' as const,
			level: 'L5' as const,
			strategy: 'workspace-ext-fallback',
			candidates: foundCandidates,
			attempted,
			reason: `Ambiguous workspace extension candidates for specifier "${specifier}": ${foundCandidates.join(', ')}`
		};
		debugCollector?.emit('resolve:strategy:complete', { strategy: 'L5', request, result }, `L5 Resolved extensionless via workspace extension fallback with ambiguity: ${foundCandidates.join(', ')}`);
		return { type: 'final', result };
	}

	return { type: 'no-decision', reason: `No workspace extension candidate exists for: ${resolvedBase}` };
}
