import fs from "fs";
import { LanguageDetector } from "./detect/detector";
import { ParserRegistry } from "./registry/types";
import { CaptureQueryRegistry } from "./query/registry";
import { normalizeCaptures } from "./normalize";
import { CaptureResult } from "./types";

export class UniversalCaptureOrchestrator {
	constructor(
		private detector: LanguageDetector,
		private parserRegistry: ParserRegistry,
		private queryRegistry: CaptureQueryRegistry
	) {}

	/**
	 * Extracts dependency edges from a file by detecting language, parsing, and executing queries.
	 *
	 * Returns null if language detection fails.
	 * Returns CaptureResult with empty edges and parseError on non-fatal failures.
	 * Throws on affinity mismatch.
	 */
	capture(filePath: string, sourceOverride?: string): CaptureResult | null {
		// 1. Detect language
		const detection = this.detector.detect(filePath);
		if (!detection) {
			return null;
		}

		const languageId = detection.languageId;

		// 2. Resolve parser adapter
		const adapter = this.parserRegistry.resolve(languageId);
		if (!adapter) {
			return {
				sourceFile: filePath,
				sourceLanguage: languageId,
				edges: [],
				parseError: `No parser adapter registered for language: ${languageId}`
			};
		}

		// 3. Resolve capture query
		const query = this.queryRegistry.resolve(languageId);
		if (!query) {
			return {
				sourceFile: filePath,
				sourceLanguage: languageId,
				edges: [],
				parseError: `No capture query registered for language: ${languageId}`
			};
		}

		// 4. Enforce adapter/query affinity
		if (query.adapterId !== adapter.adapterId) {
			throw new Error(
				`Affinity mismatch: query targets adapter "${query.adapterId}", but resolved adapter is "${adapter.adapterId}" for language "${languageId}"`
			);
		}

		// 5. Enforce presence of normalizationTable
		if (!query.normalizationTable) {
			return {
				sourceFile: filePath,
				sourceLanguage: languageId,
				edges: [],
				parseError: `Missing normalizationTable in capture query for language: ${languageId}`
			};
		}

		// 6. Read source code
		let source: string;
		try {
			source = sourceOverride !== undefined ? sourceOverride : fs.readFileSync(filePath, "utf8");
		} catch (err: any) {
			return {
				sourceFile: filePath,
				sourceLanguage: languageId,
				edges: [],
				parseError: `Failed to read file: ${err.message}`
			};
		}

		// 7. Parse source code
		const doc = adapter.parse(filePath, source, languageId);
		if (!doc) {
			return {
				sourceFile: filePath,
				sourceLanguage: languageId,
				edges: [],
				parseError: "Parser returned null tree"
			};
		}

		// 8. Run captures (even if syntax errors are present, to allow partial recovery)
		const capturedNodes = adapter.runQuery(doc, query);
		const edges = normalizeCaptures(
			capturedNodes,
			filePath,
			languageId,
			query.normalizationTable,
			query.patterns
		);

		const result: CaptureResult = {
			sourceFile: filePath,
			sourceLanguage: languageId,
			edges
		};

		if (languageId === "php") {
			const nsNode = capturedNodes.find(n => n.patternName === "namespace.declaration");
			if (nsNode) {
				result.namespaceContext = nsNode.text;
			}
		}

		if (doc.hasErrors) {
			result.parseError = "Document contains syntax errors";
		}

		return result;
	}
}
