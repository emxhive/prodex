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

export interface UniversalDependencyRequest {
	root: string;
	filePath: string;
	exclude?: string[];
}

export interface UniversalDependencyResult {
	files: string[];
	external: string[];
	unresolved: Array<{ specifier: string; reason?: string }>;
	diagnostics: Array<{ kind: string; message: string }>;
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
		const resolver = new UniversalResolver(index);
		const requests = edgesToRequests(captureResult.edges, { profile: detection.profile });

		for (const request of requests) {
			const res = resolver.resolve(request);

			if (res.status === "resolved" && res.file) {
				result.files.push(res.file);
			} else if (res.status === "external") {
				result.external.push(request.specifier);
			} else if (res.status === "unresolved") {
				const classification = classifySpecifier(request);
				
				// Keep path-like unresolved dependencies and matched PSR-4 namespace mismatches
				const isPath = classification.type === "path";
				const isMatchedPhpNamespace = request.sourceLanguage === "php" && res.strategy === "php-namespace";

				if (isPath || isMatchedPhpNamespace) {
					result.unresolved.push({
						specifier: request.specifier,
						reason: res.reason
					});
				} else {
					logger.debug(`[universal-provider] Ignored unresolved specifier: ${request.specifier} (strategy: ${res.strategy})`);
				}
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
	}
}
