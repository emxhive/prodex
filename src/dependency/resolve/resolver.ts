import path from "node:path";
import { ResolutionRequest, ResolutionResult } from "../request/types";
import { WorkspaceIndex } from "../workspace";
import { DebugCollector } from "../debug/collector";
import { classifySpecifier } from "./classify";
import { classifyOwnership, OwnershipManifestCache, shouldRunOwnershipGate } from "../ownership";
import { createPolicyDeniedOwnership, getDeniedDependencyPathMatch } from "../ownership/vendor-deny";
import { resolveExternalFilter } from "./strategies/external-filter";
import { resolveBoundary } from "./strategies/boundary";
import { resolveExactPath } from "./strategies/exact-path";
import { resolveSourceEquivSibling } from "./strategies/source-equiv-sibling";
import { resolveCallerPriorityExt } from "./strategies/caller-priority-ext";
import { resolveWorkspaceExtFallback } from "./strategies/workspace-ext-fallback";
import { resolveDirectoryEntry } from "./strategies/directory-entry";
import { resolvePhpNamespace } from "./strategies/php-namespace";
import { resolveGlobalSeed } from "./strategies/global-seed";
import { resolveUnresolved } from "./strategies/unresolved";
import { ConfigCache } from "./config-cache";
import { resolveTsConfigPaths } from "./strategies/tsconfig-paths";
import { resolveOwnedPackage } from "./strategies/owned-package";

export class UniversalResolver {
	private configCache = new ConfigCache();

	constructor(
		private index: WorkspaceIndex,
		private debugCollector?: DebugCollector,
		private ownershipManifestCache = new OwnershipManifestCache()
	) {}

	resolve(request: ResolutionRequest): ResolutionResult {
		this.debugCollector?.emit('resolve:request', {
			specifier: request.specifier,
			intent: request.intent,
			sourceFile: request.sourceFile,
			sourceLanguage: request.sourceLanguage,
			syntaxKind: request.syntaxKind
		}, `Started resolution for: ${request.specifier}`);

		const classification = classifySpecifier(request, this.debugCollector);
		this.debugCollector?.emit('resolve:classify', {
			specifier: request.specifier,
			intent: request.intent,
			sourceFile: request.sourceFile,
			sourceLanguage: request.sourceLanguage,
			syntaxKind: request.syntaxKind,
			classification
		}, `Classified specifier: ${classification.type}`);

		// L8: TSConfig / JSConfig paths / baseUrl & prodex.json aliases
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L8' });
		const l8Outcome = resolveTsConfigPaths(request, classification, this.index, this.configCache, this.debugCollector);
		if (l8Outcome.type === 'final') {
			const finalized = this.finalizeResult(request, l8Outcome.result);
			this.debugCollector?.emit('resolve:complete', { request, result: finalized }, `Resolution complete with L8`);
			return finalized;
		}

		if (shouldRunOwnershipGate(request)) {
			this.debugCollector?.emit("resolve:strategy:start", { level: "L1", strategy: "ownership-policy" });
			const ownership = classifyOwnership(request, this.index, this.ownershipManifestCache);
			this.debugCollector?.emit("resolve:ownership", { request, ownership }, ownership.message);

			if (ownership.kind === "external") {
				const result = this.finalizeResult(request, {
					status: "external",
					level: "L1",
					strategy: "ownership-policy",
					confidence: "high",
					reason: ownership.message,
					ownership
				});
				this.debugCollector?.emit("resolve:complete", { request, result }, `Resolution complete with ownership policy`);
				return result;
			}

			if (ownership.kind === "unresolved") {
				const result = this.finalizeResult(request, {
					status: "unresolved",
					level: "L1",
					strategy: "ownership-policy",
					reason: ownership.message,
					ownership
				});
				this.debugCollector?.emit("resolve:complete", { request, result }, `Resolution complete with ownership policy`);
				return result;
			}

			const ownedResult = this.finalizeResult(request, resolveOwnedPackage(request, ownership, this.index, this.debugCollector));
			this.debugCollector?.emit("resolve:complete", { request, result: ownedResult }, `Resolution complete with ownership local policy`);
			return ownedResult;
		}

		// L1: External/system/url filter
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L1' });
		const l1Outcome = resolveExternalFilter(request, classification, this.debugCollector);
		if (l1Outcome.type === 'final') {
			const finalized = this.finalizeResult(request, l1Outcome.result);
			this.debugCollector?.emit('resolve:complete', { request, result: finalized }, `Resolution complete with L1`);
			return finalized;
		}

		// L2: Workspace boundary enforcement
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L2' });
		const l2Outcome = resolveBoundary(request, classification, this.index, this.debugCollector);
		if (l2Outcome.type === 'final') {
			const finalized = this.finalizeResult(request, l2Outcome.result);
			this.debugCollector?.emit('resolve:complete', { request, result: finalized }, `Resolution complete with L2`);
			return finalized;
		}

		// L3: Exact path resolution
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L3' });
		const l3Outcome = resolveExactPath(request, classification, this.index, this.debugCollector);
		if (l3Outcome.type === 'final') {
			const finalized = this.finalizeResult(request, l3Outcome.result);
			this.debugCollector?.emit('resolve:complete', { request, result: finalized }, `Resolution complete with L3`);
			return finalized;
		}

		// L3.5: Source-equivalent sibling remap
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L3.5' });
		const l35Outcome = resolveSourceEquivSibling(request, classification, this.index, this.debugCollector);
		if (l35Outcome.type === 'final') {
			const finalized = this.finalizeResult(request, l35Outcome.result);
			this.debugCollector?.emit('resolve:complete', { request, result: finalized }, `Resolution complete with L3.5`);
			return finalized;
		}

		// L4: Caller-priority extension completion
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L4' });
		const l4Outcome = resolveCallerPriorityExt(request, classification, this.index, this.debugCollector);
		if (l4Outcome.type === 'final') {
			const finalized = this.finalizeResult(request, l4Outcome.result);
			this.debugCollector?.emit('resolve:complete', { request, result: finalized }, `Resolution complete with L4`);
			return finalized;
		}

		// L5: Workspace-extension fallback
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L5' });
		const l5Outcome = resolveWorkspaceExtFallback(request, classification, this.index, this.debugCollector);
		if (l5Outcome.type === 'final') {
			const finalized = this.finalizeResult(request, l5Outcome.result);
			this.debugCollector?.emit('resolve:complete', { request, result: finalized }, `Resolution complete with L5`);
			return finalized;
		}

		// L6: Directory entry resolution
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L6' });
		const l6Outcome = resolveDirectoryEntry(request, classification, this.index, this.debugCollector);
		if (l6Outcome.type === 'final') {
			const finalized = this.finalizeResult(request, l6Outcome.result);
			this.debugCollector?.emit('resolve:complete', { request, result: finalized }, `Resolution complete with L6`);
			return finalized;
		}

		// L10: PHP namespace resolution strategy
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L10' });
		const l10Outcome = resolvePhpNamespace(request, classification, this.index, this.debugCollector);
		if (l10Outcome.type === 'final') {
			const finalized = this.finalizeResult(request, l10Outcome.result);
			this.debugCollector?.emit('resolve:complete', { request, result: finalized }, `Resolution complete with L10`);
			return finalized;
		}

		// L7: Global stem/basename seed target resolution
		this.debugCollector?.emit('resolve:strategy:start', { level: 'L7' });
		const l7Outcome = resolveGlobalSeed(request, classification, this.index, this.debugCollector);
		if (l7Outcome.type === 'final') {
			const finalized = this.finalizeResult(request, l7Outcome.result);
			this.debugCollector?.emit('resolve:complete', { request, result: finalized }, `Resolution complete with L7`);
			return finalized;
		}

		// LX: Unresolved / unsupported fallback
		this.debugCollector?.emit('resolve:strategy:start', { level: 'LX' });
		const lxOutcome = resolveUnresolved(request, classification, this.debugCollector);
		if (lxOutcome.type === 'final') {
			const finalized = this.finalizeResult(request, lxOutcome.result);
			this.debugCollector?.emit('resolve:complete', { request, result: finalized }, `Resolution complete with LX`);
			return finalized;
		}

		// Fallback block that should never be hit
		const fallback: ResolutionResult = {
			status: 'unresolved',
			level: 'LX',
			strategy: 'unresolved-fallback',
			reason: 'Fell through strategy pipeline.'
		};
		return this.finalizeResult(request, fallback);
	}

	private finalizeResult(request: ResolutionRequest, result: ResolutionResult): ResolutionResult {
		const denied = this.findDeniedResultPath(result) ?? this.findDeniedRequestPath(request);
		if (!denied) return result;

		const ownership = createPolicyDeniedOwnership({
			specifier: request.specifier,
			ecosystem: request.sourceLanguage ?? request.profile?.languageId,
			sourceFile: request.sourceFile,
			deniedPath: denied.path,
			segment: denied.segment,
			specifierRoot: result.ownership?.specifierRoot
		});

		return {
			status: "unresolved",
			level: result.level,
			strategy: result.strategy ?? "policy-denied",
			reason: ownership.message,
			attempted: Array.from(new Set([...(result.attempted || []), denied.path])),
			ownership
		};
	}

	private findDeniedResultPath(result: ResolutionResult) {
		for (const candidate of [
			...(result.file ? [result.file] : []),
			...(result.files || []),
			...(result.candidates || []),
			...(result.attempted || [])
		]) {
			const denied = getDeniedDependencyPathMatch(candidate, this.index.root);
			if (denied) return denied;
		}
		return undefined;
	}

	private findDeniedRequestPath(request: ResolutionRequest) {
		const classification = classifySpecifier(request, this.debugCollector);
		if (classification.type !== "path") return undefined;

		const specifier = classification.specifier;
		const baseFile = request.origin?.path || request.sourceFile;
		let candidatePath: string;
		if (path.isAbsolute(specifier)) {
			candidatePath = path.resolve(specifier);
		} else if (baseFile) {
			const basePath = path.isAbsolute(baseFile) ? baseFile : path.resolve(this.index.root, baseFile);
			candidatePath = path.resolve(path.dirname(basePath), specifier);
		} else {
			candidatePath = path.resolve(this.index.root, specifier);
		}
		return getDeniedDependencyPathMatch(candidatePath, this.index.root);
	}
}
