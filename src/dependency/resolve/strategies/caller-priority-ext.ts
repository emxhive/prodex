import path from "path";
import { ResolutionRequest } from "../../request/types";
import { SpecifierClassification, resolveRequestBasePath, isStaticPathEligible } from "../classify";
import { StrategyOutcome } from "../types";
import { WorkspaceIndex } from "../../workspace";
import { normalizePath } from "../../../filesystem/path";
import { DebugCollector } from "../../debug/collector";
import { getExtensionPriorityGroups } from "../profile/extension-priority";

export function resolveCallerPriorityExt(
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

	// Determine caller source extension or language
	const sourceContext = request.sourceFile
		? path.extname(request.sourceFile)
		: request.sourceLanguage;
	const groups = request.profile?.extensionPriorityGroups && request.profile.extensionPriorityGroups.length > 0
		? request.profile.extensionPriorityGroups
		: getExtensionPriorityGroups(sourceContext);
	if (groups.length === 0) {
		return { type: 'no-decision', reason: `No priority extension groups found for context: ${sourceContext}` };
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

	for (const group of groups) {
		const foundInGroup: string[] = [];
		for (const candExt of group) {
			const candidatePath = normalizePath(`${resolvedBase}${candExt}`);
			attempted.push(candidatePath);
			if (index.filesByAbsolute.has(candidatePath)) {
				foundInGroup.push(candidatePath);
			}
		}

		if (foundInGroup.length === 1) {
			const result = {
				status: 'resolved' as const,
				level: 'L4' as const,
				strategy: 'caller-priority-ext',
				confidence: 'high' as const,
				file: foundInGroup[0],
				files: [foundInGroup[0]],
				attempted
			};
			debugCollector?.emit('resolve:strategy:complete', { strategy: 'L4', request, result }, `L4 Resolved extensionless via caller priority: ${foundInGroup[0]}`);
			return { type: 'final', result };
		}

		if (foundInGroup.length > 1) {
			const result = {
				status: 'ambiguous' as const,
				level: 'L4' as const,
				strategy: 'caller-priority-ext',
				candidates: foundInGroup,
				attempted,
				reason: `Ambiguous candidates in same priority group for specifier "${specifier}": ${foundInGroup.join(', ')}`
			};
			debugCollector?.emit('resolve:strategy:complete', { strategy: 'L4', request, result }, `L4 Resolved extensionless via caller priority with ambiguity: ${foundInGroup.join(', ')}`);
			return { type: 'final', result };
		}
	}

	return { type: 'no-decision', reason: `No caller priority candidate exists for: ${resolvedBase}` };
}
