import path from "path";
import { ResolutionRequest } from "../../request/types";
import { SpecifierClassification, resolveRequestBasePath } from "../classify";
import { StrategyOutcome } from "../types";
import { WorkspaceIndex } from "../../workspace";
import { normalizePath } from "../../../filesystem/path";
import { DebugCollector } from "../../debug/collector";
import { SOURCE_EQUIV_MAP, isDeclarationOnlyPath } from "../profile/extension-priority";

export function resolveSourceEquivSibling(
	request: ResolutionRequest,
	classification: SpecifierClassification,
	index: WorkspaceIndex,
	debugCollector?: DebugCollector
): StrategyOutcome {
	if (classification.type !== 'path') {
		return { type: 'no-decision', reason: 'Not a path specifier.' };
	}

	const specifier = classification.specifier;
	const ext = path.extname(specifier);
	if (!ext) {
		return { type: 'no-decision', reason: 'Specifier has no explicit extension.' };
	}

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

	// Sibling stem and directory
	const specDir = normalizePath(path.dirname(resolvedPath));
	const stem = path.basename(resolvedPath, ext);

	const lowExt = ext.toLowerCase();
	const equivCandidates = SOURCE_EQUIV_MAP[lowExt];
	if (!equivCandidates) {
		return { type: 'no-decision', reason: `No source equivalence mapped for extension: ${ext}` };
	}

	const attempted: string[] = [];
	const foundCandidates: string[] = [];

	for (const candExt of equivCandidates) {
		const candidatePath = normalizePath(path.join(specDir, `${stem}${candExt}`));
		attempted.push(candidatePath);
		if (index.filesByAbsolute.has(candidatePath)) {
			if (!isDeclarationOnlyPath(candidatePath)) {
				foundCandidates.push(candidatePath);
			}
		}
	}

	if (foundCandidates.length === 1) {
		const result = {
			status: 'resolved' as const,
			level: 'L3.5' as const,
			strategy: 'source-equiv-sibling',
			confidence: 'medium' as const,
			file: foundCandidates[0],
			files: [foundCandidates[0]],
			attempted
		};
		debugCollector?.emit('resolve:strategy:complete', { strategy: 'L3.5', request, result }, `L3.5 Resolved source equivalence sibling: ${foundCandidates[0]}`);
		return { type: 'final', result };
	}

	if (foundCandidates.length > 1) {
		const result = {
			status: 'ambiguous' as const,
			level: 'L3.5' as const,
			strategy: 'source-equiv-sibling',
			candidates: foundCandidates,
			attempted,
			reason: `Ambiguous source equivalents for specifier "${specifier}": ${foundCandidates.join(', ')}`
		};
		debugCollector?.emit('resolve:strategy:complete', { strategy: 'L3.5', request, result }, `L3.5 Resolved source equivalence with ambiguity: ${foundCandidates.join(', ')}`);
		return { type: 'final', result };
	}

	return { type: 'no-decision', reason: `No source equivalent sibling found for: ${resolvedPath}` };
}
