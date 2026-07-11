import path from "node:path";
import { UniversalCaptureOrchestrator } from "../capture/orchestrator";
import { TreeSitterParserAdapter } from "../capture/adapter/tree-sitter";
import { JAVASCRIPT_CAPTURE_QUERY } from "../capture/adapter/tree-sitter/queries/javascript";
import { PHP_CAPTURE_QUERY } from "../capture/adapter/tree-sitter/queries/php";
import { TYPESCRIPT_CAPTURE_QUERY } from "../capture/adapter/tree-sitter/queries/typescript";
import { TSX_CAPTURE_QUERY } from "../capture/adapter/tree-sitter/queries/tsx";
import { FileExtensionDetector } from "../capture/detect/detector";
import { JAVASCRIPT_PROFILE } from "../capture/profiles/javascript";
import { PHP_PROFILE } from "../capture/profiles/php";
import { TYPESCRIPT_PROFILE } from "../capture/profiles/typescript";
import { TSX_PROFILE } from "../capture/profiles/tsx";
import { DefaultParserRegistry } from "../capture/registry/registry";
import { DefaultCaptureQueryRegistry } from "../capture/query/registry";
import { edgesToRequests } from "../capture/bridge";
import { UniversalResolver } from "../resolve/resolver";
import { indexWorkspace, WorkspaceIndex } from "../workspace";
import { classifySpecifier } from "../resolve/classify";
import { logger } from "../../diagnostics/logger";
import { DependencyOwnershipResult, OwnershipDiagnostic, OwnershipManifestCache } from "../ownership";

export interface UniversalDependencyRequest {
	root: string;
	filePath: string;
	exclude?: string[];
	aliases?: Record<string, string>;
}

export interface UniversalDependencyResult {
	files: string[];
	external: string[];
	unresolved: Array<{ specifier: string; reason?: string }>;
	ownership: DependencyOwnershipResult[];
	diagnostics: OwnershipDiagnostic[];
}

export interface UniversalDependencyProviderOptions {
	wasmPaths?: {
		javascript?: string;
		php?: string;
		typescript?: string;
		tsx?: string;
	};
}

export class UniversalDependencyProvider {
	private orchestrator: UniversalCaptureOrchestrator;
	private indexCache = new Map<string, WorkspaceIndex>();
	private ownershipManifestCache = new OwnershipManifestCache();

	private constructor(orchestrator: UniversalCaptureOrchestrator) {
		this.orchestrator = orchestrator;
	}

	static async create(options: UniversalDependencyProviderOptions = {}): Promise<UniversalDependencyProvider> {
		const javascriptWasm = options.wasmPaths?.javascript ||
			process.env.PRODEX_JS_WASM ||
			path.resolve(__dirname, "../../../assets/tree-sitter/tree-sitter-javascript.wasm");

		const phpWasm = options.wasmPaths?.php ||
			process.env.PRODEX_PHP_WASM ||
			path.resolve(__dirname, "../../../assets/tree-sitter/tree-sitter-php.wasm");

		const typescriptWasm = options.wasmPaths?.typescript ||
			process.env.PRODEX_TYPESCRIPT_WASM ||
			path.resolve(__dirname, "../../../assets/tree-sitter/tree-sitter-typescript.wasm");

		const tsxWasm = options.wasmPaths?.tsx ||
			process.env.PRODEX_TSX_WASM ||
			path.resolve(__dirname, "../../../assets/tree-sitter/tree-sitter-tsx.wasm");

		const tsAdapter = await TreeSitterParserAdapter.create({
			javascript: javascriptWasm,
			php: phpWasm,
			typescript: typescriptWasm,
			tsx: tsxWasm
		});

		const detector = new FileExtensionDetector();
		detector.registerProfile(JAVASCRIPT_PROFILE);
		detector.registerProfile(PHP_PROFILE);
		detector.registerProfile(TYPESCRIPT_PROFILE);
		detector.registerProfile(TSX_PROFILE);

		const parserRegistry = new DefaultParserRegistry();
		parserRegistry.register(tsAdapter);

		const queryRegistry = new DefaultCaptureQueryRegistry();
		queryRegistry.register(JAVASCRIPT_CAPTURE_QUERY);
		queryRegistry.register(PHP_CAPTURE_QUERY);
		queryRegistry.register(TYPESCRIPT_CAPTURE_QUERY);
		queryRegistry.register(TSX_CAPTURE_QUERY);

		const orchestrator = new UniversalCaptureOrchestrator(detector, parserRegistry, queryRegistry);
		return new UniversalDependencyProvider(orchestrator);
	}

	async resolve(req: UniversalDependencyRequest): Promise<UniversalDependencyResult> {
		const { root, filePath, exclude } = req;

		const result: UniversalDependencyResult = {
			files: [],
			external: [],
			unresolved: [],
			ownership: [],
			diagnostics: []
		};

		// 1. Detect profile
		const detection = this.orchestrator["detector"].detect(filePath);
		if (!detection) {
			logger.debug(`[universal-provider] Unsupported extension for universal provider: ${filePath}`);
			result.diagnostics.push({
				kind: "unsupported-profile",
				message: `Unsupported extension for dependency capture: ${path.extname(filePath)}`
			});
			return result;
		}

		// 2. Capture specifiers
		let captureResult;
		try {
			captureResult = this.orchestrator.capture(filePath);
		} catch (err: any) {
			logger.warn(`[universal-provider] Orchestrator capture failed for ${filePath}: ${err.message}`);
			result.diagnostics.push({
				kind: "capture-failure",
				message: `Orchestrator capture failed: ${err.message}`
			});
			return result;
		}

		if (!captureResult) {
			return result;
		}

		if (captureResult.parseError) {
			result.diagnostics.push({
				kind: "parse-error",
				message: captureResult.parseError
			});
		}

		if (captureResult.edges.length === 0) {
			return result;
		}

		// 3. Get or build WorkspaceIndex (cached)
		const index = await this.getOrBuildIndex(root, exclude);

		// 4. Resolve specifier requests
		const resolver = new UniversalResolver(index, undefined, this.ownershipManifestCache);
		const requests = edgesToRequests(captureResult.edges, {
			profile: detection.profile,
			aliases: req.aliases
		});

		for (const request of requests) {
			const res = resolver.resolve(request);
			if (res.ownership) {
				result.ownership.push(res.ownership);
				if (shouldSurfaceOwnershipDiagnostic(res.ownership)) {
					result.diagnostics.push({
						kind: `ownership-${res.ownership.reason}`,
						message: res.ownership.message ?? res.reason ?? `Dependency ownership classified "${request.specifier}" as ${res.ownership.kind}/${res.ownership.reason}.`,
						ownership: res.ownership
					});
				}
			}

			if (res.status === "resolved" && res.file) {
				result.files.push(res.file);
			} else if (res.status === "external") {
				result.external.push(request.specifier);
			} else if (res.status === "unresolved") {
				const classification = classifySpecifier(request);
				
				// Keep path-like unresolved dependencies, matched PSR-4 namespace mismatches, and matched L8 path aliases
				const isPath = classification.type === "path";
				const isMatchedPhpNamespace = request.sourceLanguage === "php" && res.strategy === "php-namespace";
				const isMatchedAlias = res.level === "L8" && (res.strategy === "tsconfig-paths" || res.strategy === "prodex-alias");
				const isOwnershipUnresolved = res.ownership?.kind === "unresolved";

				if (isPath || isMatchedPhpNamespace || isMatchedAlias || isOwnershipUnresolved) {
					result.unresolved.push({
						specifier: request.specifier,
						reason: res.reason
					});
				} else {
					logger.debug(`[universal-provider] Ignored unresolved specifier: ${request.specifier} (strategy: ${res.strategy})`);
				}
			} else if (res.status === "blocked") {
				result.unresolved.push({
					specifier: request.specifier,
					reason: res.reason
				});
				result.diagnostics.push({
					kind: "resolver-blocked",
					message: res.reason ?? `Dependency resolution blocked for "${request.specifier}".`,
					ownership: res.ownership
				});
			}
		}

		// Normalize unique outputs
		result.files = Array.from(new Set(result.files));
		result.external = Array.from(new Set(result.external));

		return result;
	}

	private async getOrBuildIndex(root: string, exclude?: string[]): Promise<WorkspaceIndex> {
		const sortedExclude = [...(exclude || [])].sort();
		const cacheKey = `${root}::${sortedExclude.join(",")}`;

		let index = this.indexCache.get(cacheKey);
		if (!index) {
			index = await indexWorkspace(root, exclude);
			this.indexCache.set(cacheKey, index);
		}
		return index;
	}

	clearCache(): void {
		this.indexCache.clear();
		this.ownershipManifestCache.clear();
	}
}

function shouldSurfaceOwnershipDiagnostic(ownership: DependencyOwnershipResult): boolean {
	if (ownership.kind !== "unresolved") return false;
	return ownership.reason === "undeclared" ||
		ownership.reason === "policy-denied" ||
		ownership.reason === "unknown" ||
		ownership.reason === "unsupported";
}
