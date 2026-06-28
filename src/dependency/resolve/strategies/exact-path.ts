import path from "path";
import { ResolutionRequest } from "../../request/types";
import { SpecifierClassification, resolveRequestBasePath } from "../classify";
import { StrategyOutcome } from "../types";
import { WorkspaceIndex } from "../../workspace";
import { normalizePath } from "../../../filesystem/path";
import { DebugCollector } from "../../debug/collector";

export function resolveExactPath(
	request: ResolutionRequest,
	classification: SpecifierClassification,
	index: WorkspaceIndex,
	debugCollector?: DebugCollector
): StrategyOutcome {
	if (classification.type !== 'path') {
		return { type: 'no-decision', reason: 'Not a path specifier.' };
	}

	const specifier = classification.specifier;
	let resolvedPath: string;

	const baseFile = resolveRequestBasePath(request, index);

	if (path.isAbsolute(specifier)) {
		resolvedPath = normalizePath(path.resolve(specifier));
	} else if (baseFile) {
		const originDir = path.dirname(baseFile);
		resolvedPath = normalizePath(path.resolve(originDir, specifier));
	} else {
		resolvedPath = normalizePath(path.resolve(index.root, specifier));
	}

	if (index.filesByAbsolute.has(resolvedPath)) {
		const result = {
			status: 'resolved' as const,
			level: 'L3' as const,
			strategy: 'exact-path',
			confidence: 'high' as const,
			file: resolvedPath,
			files: [resolvedPath]
		};
		debugCollector?.emit('resolve:strategy:complete', { strategy: 'L3', request, result }, `L3 Resolved exact path: ${resolvedPath}`);
		return { type: 'final', result };
	}

	return { type: 'no-decision', reason: `Exact path not found in index: ${resolvedPath}` };
}
