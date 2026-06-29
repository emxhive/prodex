import path from "path";
import { ResolutionRequest } from "../../request/types";
import { SpecifierClassification, resolveRequestBasePath } from "../classify";
import { StrategyOutcome } from "../types";
import { WorkspaceIndex } from "../../workspace";
import { normalizePath } from "../../../filesystem/path";
import { DebugCollector } from "../../debug/collector";
import { getExtensionPriorityGroups } from "../profile/extension-priority";

export function resolveDirectoryEntry(
	request: ResolutionRequest,
	classification: SpecifierClassification,
	index: WorkspaceIndex,
	debugCollector?: DebugCollector
): StrategyOutcome {
	if (classification.type !== 'path') {
		return { type: 'no-decision', reason: 'Not a path specifier.' };
	}

	const specifier = classification.specifier;
	const baseFile = resolveRequestBasePath(request, index);
	let resolvedPath: string;

	if (path.isAbsolute(specifier)) {
		resolvedPath = normalizePath(path.resolve(specifier));
	} else if (baseFile) {
		const originDir = path.dirname(baseFile);
		resolvedPath = normalizePath(path.resolve(originDir, specifier));
	} else {
		resolvedPath = normalizePath(path.resolve(index.root, specifier));
	}

	// Check if directory exists in the index
	if (!index.directories.has(resolvedPath)) {
		return { type: 'no-decision', reason: `Directory not found in workspace index: ${resolvedPath}` };
	}

	const sourceContext = request.sourceFile
		? path.extname(request.sourceFile)
		: request.sourceLanguage;
	const groups = request.profile?.extensionPriorityGroups && request.profile.extensionPriorityGroups.length > 0
		? request.profile.extensionPriorityGroups
		: getExtensionPriorityGroups(sourceContext);
	const entryNames = ["index"];
	const attempted: string[] = [];

	// Priority groups check (if context exists and gives priority groups)
	if (groups.length > 0) {
		for (const entryName of entryNames) {
			for (const group of groups) {
				const foundInGroup: string[] = [];
				for (const candExt of group) {
					const candidatePath = normalizePath(path.join(resolvedPath, `${entryName}${candExt}`));
					attempted.push(candidatePath);
					if (index.filesByAbsolute.has(candidatePath)) {
						foundInGroup.push(candidatePath);
					}
				}

				if (foundInGroup.length === 1) {
					const result = {
						status: 'resolved' as const,
						level: 'L6' as const,
						strategy: 'directory-entry',
						confidence: 'high' as const,
						file: foundInGroup[0],
						files: [foundInGroup[0]],
						attempted
					};
					debugCollector?.emit('resolve:strategy:complete', { strategy: 'L6', request, result }, `L6 Resolved directory index via priority group: ${foundInGroup[0]}`);
					return { type: 'final', result };
				}

				if (foundInGroup.length > 1) {
					const result = {
						status: 'ambiguous' as const,
						level: 'L6' as const,
						strategy: 'directory-entry',
						candidates: foundInGroup,
						attempted,
						reason: `Ambiguous same-priority directory entries for "${specifier}": ${foundInGroup.join(', ')}`
					};
					debugCollector?.emit('resolve:strategy:complete', { strategy: 'L6', request, result }, `L6 Resolved directory index via priority group with ambiguity: ${foundInGroup.join(', ')}`);
					return { type: 'final', result };
				}
			}
		}
	}

	// Fallback to workspace extensions (no priority groups or priority groups yielded no match)
	const foundFallback: string[] = [];
	for (const entryName of entryNames) {
		for (const candExt of index.extensionsPresent) {
			const candidatePath = normalizePath(path.join(resolvedPath, `${entryName}${candExt}`));
			attempted.push(candidatePath);
			if (index.filesByAbsolute.has(candidatePath)) {
				foundFallback.push(candidatePath);
			}
		}
	}

	// Remove duplicates
	const uniqueFallback = Array.from(new Set(foundFallback)).sort();

	if (uniqueFallback.length === 1) {
		const result = {
			status: 'resolved' as const,
			level: 'L6' as const,
			strategy: 'directory-entry',
			confidence: 'low' as const,
			file: uniqueFallback[0],
			files: [uniqueFallback[0]],
			attempted
		};
		debugCollector?.emit('resolve:strategy:complete', { strategy: 'L6', request, result }, `L6 Resolved directory index via workspace fallback: ${uniqueFallback[0]}`);
		return { type: 'final', result };
	}

	if (uniqueFallback.length > 1) {
		const result = {
			status: 'ambiguous' as const,
			level: 'L6' as const,
			strategy: 'directory-entry',
			candidates: uniqueFallback,
			attempted,
			reason: `Ambiguous directory entries found in workspace fallback: ${uniqueFallback.join(', ')}`
		};
		debugCollector?.emit('resolve:strategy:complete', { strategy: 'L6', request, result }, `L6 Resolved directory index via workspace fallback with ambiguity: ${uniqueFallback.join(', ')}`);
		return { type: 'final', result };
	}

	return { type: 'no-decision', reason: `No matching entry files found in directory: ${resolvedPath}` };
}
