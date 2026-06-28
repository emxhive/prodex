import { ResolutionRequest } from "../../request/types";
import { SpecifierClassification } from "../classify";
import { StrategyOutcome } from "../types";
import { DebugCollector } from "../../debug/collector";

export function resolveUnresolved(
	request: ResolutionRequest,
	classification: SpecifierClassification,
	debugCollector?: DebugCollector
): StrategyOutcome {
	if (classification.type === 'dynamic') {
		const result = {
			status: 'unresolved' as const,
			level: 'LX' as const,
			strategy: 'unresolved-dynamic',
			reason: `Dynamic imports are intentionally unsupported and cannot be resolved.`
		};
		debugCollector?.emit('resolve:strategy:complete', { strategy: 'LX', request, result }, `LX Unresolved dynamic: ${request.specifier}`);
		return { type: 'final', result };
	}

	const result = {
		status: 'unresolved' as const,
		level: 'LX' as const,
		strategy: 'unresolved-fallback',
		reason: `No strategy was able to resolve specifier "${request.specifier}".`
	};
	debugCollector?.emit('resolve:strategy:complete', { strategy: 'LX', request, result }, `LX Unresolved fallback: ${request.specifier}`);
	return { type: 'final', result };
}
