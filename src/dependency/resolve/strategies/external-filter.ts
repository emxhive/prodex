import { ResolutionRequest } from "../../request/types";
import { SpecifierClassification } from "../classify";
import { StrategyOutcome } from "../types";
import { DebugCollector } from "../../debug/collector";

export function resolveExternalFilter(
	request: ResolutionRequest,
	classification: SpecifierClassification,
	debugCollector?: DebugCollector
): StrategyOutcome {
	if (request.semantics) {
		if (request.semantics.domain === 'file' || request.semantics.domain === 'symbol') {
			return { type: 'no-decision', reason: 'File or symbol reference is not applicable to L1 external filter.' };
		}
	}

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
		let scheme = '';
		const match = request.specifier.trim().match(/^([a-zA-Z0-9+-.]+):/);
		if (match) {
			scheme = match[1].toLowerCase() + ':';
		}

		const externalSchemes = ['https:', 'http:', 'ftp:'];
		if (externalSchemes.includes(scheme)) {
			// Known-external schemes -> terminate here as external
			const result = {
				status: 'external' as const,
				level: 'L1' as const,
				strategy: 'url-filter',
				confidence: 'high' as const,
				reason: `URL specifier "${request.specifier}" with recognized external scheme "${scheme}" is classified as external.`
			};
			debugCollector?.emit('resolve:strategy:complete', { strategy: 'L1', request, result }, `L1 Resolved URL: ${request.specifier}`);
			return { type: 'final', result };
		} else {
			// file:, future schemes, unknown schemes -> no-decision (passthrough)
			// A later scheme-specific resolver may handle these. If none does, LX will terminate.
			return { type: 'no-decision', reason: `URL scheme "${scheme}" is not recognized as always external.` };
		}
	}

	return { type: 'no-decision', reason: 'Not an external or URL specifier.' };
}
