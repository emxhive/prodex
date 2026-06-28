import { ResolutionRequest } from "../../request/types";
import { SpecifierClassification } from "../classify";
import { StrategyOutcome } from "../types";
import { DebugCollector } from "../../debug/collector";

export function resolveExternalFilter(
	request: ResolutionRequest,
	classification: SpecifierClassification,
	debugCollector?: DebugCollector
): StrategyOutcome {
	if (classification.type === 'external') {
		const result = {
			status: 'external' as const,
			level: 'L1' as const,
			strategy: 'external-filter',
			confidence: 'high' as const,
			reason: `Specifier "${request.specifier}" is classified as an external package or system library.`
		};
		debugCollector?.emit('resolve:strategy:complete', { strategy: 'L1', request, result }, `L1 Resolved external: ${request.specifier}`);
		return { type: 'final', result };
	}

	if (classification.type === 'url') {
		const result = {
			status: 'external' as const,
			level: 'L1' as const,
			strategy: 'url-filter',
			confidence: 'high' as const,
			reason: `URL specifier "${request.specifier}" is classified as external.`
		};
		debugCollector?.emit('resolve:strategy:complete', { strategy: 'L1', request, result }, `L1 Resolved URL: ${request.specifier}`);
		return { type: 'final', result };
	}

	return { type: 'no-decision', reason: 'Not an external or URL specifier.' };
}
