import { ResolutionRequest } from "../../request/types";
import { SpecifierClassification } from "../classify";
import { StrategyOutcome } from "../types";
import { WorkspaceIndex } from "../../workspace";
import { DebugCollector } from "../../debug/collector";

export function resolveGlobalSeed(
	request: ResolutionRequest,
	classification: SpecifierClassification,
	index: WorkspaceIndex,
	debugCollector?: DebugCollector
): StrategyOutcome {
	// L7 global stem/basename resolution applies to seed requests only
	if (request.intent !== 'seed-target' && request.intent !== 'seed-entry') {
		return { type: 'no-decision', reason: 'Not a seed request.' };
	}

	const specifier = classification.specifier;

	const matchesByBasename = index.filesByBasename.get(specifier) || [];
	const matchesByStem = index.filesByStem.get(specifier) || [];

	const candidatesSet = new Set([...matchesByBasename, ...matchesByStem]);
	const candidates = Array.from(candidatesSet).sort();

	if (candidates.length === 1) {
		const result = {
			status: 'resolved' as const,
			level: 'L7' as const,
			strategy: 'global-seed',
			confidence: 'high' as const,
			file: candidates[0],
			files: [candidates[0]]
		};
		debugCollector?.emit('resolve:strategy:complete', { strategy: 'L7', request, result }, `L7 Resolved global seed: ${candidates[0]}`);
		return { type: 'final', result };
	}

	if (candidates.length > 1) {
		const result = {
			status: 'ambiguous' as const,
			level: 'L7' as const,
			strategy: 'global-seed',
			candidates,
			reason: `Ambiguous target "${specifier}". Basename/stem matches multiple candidates.`
		};
		debugCollector?.emit('resolve:strategy:complete', { strategy: 'L7', request, result }, `L7 Resolved global seed with ambiguity: ${candidates.join(', ')}`);
		return { type: 'final', result };
	}

	return { type: 'no-decision', reason: `No basename/stem matches for seed: ${specifier}` };
}
