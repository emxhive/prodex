import { ResolutionRequest, ResolutionResult } from "../request/types";
import { WorkspaceIndex } from "../workspace";
import { DebugCollector } from "../debug/collector";
import { classifySpecifier } from "./classify";
import { resolveExternalFilter } from "./strategies/external-filter";
import { resolveBoundary } from "./strategies/boundary";
import { resolveExactPath } from "./strategies/exact-path";
import { resolveGlobalSeed } from "./strategies/global-seed";
import { resolveUnresolved } from "./strategies/unresolved";

export class UniversalResolver {
	constructor(
		private index: WorkspaceIndex,
		private debugCollector?: DebugCollector
	) {}

	resolve(request: ResolutionRequest): ResolutionResult {
		this.debugCollector?.emit('resolve:request', {
			specifier: request.specifier,
			intent: request.intent,
			sourceFile: request.sourceFile,
			sourceLanguage: request.sourceLanguage,
			syntaxKind: request.syntaxKind
		}, `Started resolution for: ${request.specifier}`);

		const classification = classifySpecifier(request);
		this.debugCollector?.emit('resolve:classify', {
			specifier: request.specifier,
			intent: request.intent,
			sourceFile: request.sourceFile,
			sourceLanguage: request.sourceLanguage,
			syntaxKind: request.syntaxKind,
			classification
		}, `Classified specifier: ${classification.type}`);

		// L1: External/system/url filter
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L1' });
		const l1Outcome = resolveExternalFilter(request, classification, this.debugCollector);
		if (l1Outcome.type === 'final') {
			this.debugCollector?.emit('resolve:complete', { request, result: l1Outcome.result }, `Resolution complete with L1`);
			return l1Outcome.result;
		}

		// L2: Workspace boundary enforcement
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L2' });
		const l2Outcome = resolveBoundary(request, classification, this.index, this.debugCollector);
		if (l2Outcome.type === 'final') {
			this.debugCollector?.emit('resolve:complete', { request, result: l2Outcome.result }, `Resolution complete with L2`);
			return l2Outcome.result;
		}

		// L3: Exact path resolution
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L3' });
		const l3Outcome = resolveExactPath(request, classification, this.index, this.debugCollector);
		if (l3Outcome.type === 'final') {
			this.debugCollector?.emit('resolve:complete', { request, result: l3Outcome.result }, `Resolution complete with L3`);
			return l3Outcome.result;
		}

		// L7: Global stem/basename seed target resolution
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L7' });
		const l7Outcome = resolveGlobalSeed(request, classification, this.index, this.debugCollector);
		if (l7Outcome.type === 'final') {
			this.debugCollector?.emit('resolve:complete', { request, result: l7Outcome.result }, `Resolution complete with L7`);
			return l7Outcome.result;
		}

		// LX: Unresolved / unsupported fallback
		this.debugCollector?.emit('resolve:strategy:start', { level: 'LX' });
		const lxOutcome = resolveUnresolved(request, classification, this.debugCollector);
		if (lxOutcome.type === 'final') {
			this.debugCollector?.emit('resolve:complete', { request, result: lxOutcome.result }, `Resolution complete with LX`);
			return lxOutcome.result;
		}

		// Fallback block that should never be hit
		const fallback: ResolutionResult = {
			status: 'unresolved',
			level: 'LX',
			strategy: 'unresolved-fallback',
			reason: 'Fell through strategy pipeline.'
		};
		return fallback;
	}
}
