import path from "path";
import { ResolutionRequest } from "../../request/types";
import { SpecifierClassification, resolveRequestBasePath } from "../classify";
import { StrategyOutcome } from "../types";
import { WorkspaceIndex } from "../../workspace";
import { normalizePath } from "../../../filesystem/path";
import { DebugCollector } from "../../debug/collector";

export function resolveBoundary(
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

	const relative = path.relative(index.root, resolvedPath);
	const isOutside = relative.startsWith('..') || path.isAbsolute(relative);

	if (isOutside) {
		const result = {
			status: 'blocked' as const,
			level: 'L2' as const,
			strategy: 'boundary',
			reason: `Target path "${resolvedPath}" escapes workspace root "${index.root}"`
		};
		debugCollector?.emit('resolve:strategy:complete', { strategy: 'L2', request, result }, `L2 Blocked boundary: ${request.specifier}`);
		return { type: 'final', result };
	}

	return { type: 'no-decision', reason: 'Path is inside workspace boundary.' };
}
