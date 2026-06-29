const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const fs = require("node:fs");

const { UniversalCaptureOrchestrator } = require("../dist/dependency/capture/orchestrator.js");
const { TreeSitterParserAdapter } = require("../dist/dependency/capture/adapter/tree-sitter/index.js");
const { JAVASCRIPT_CAPTURE_QUERY } = require("../dist/dependency/capture/adapter/tree-sitter/queries/javascript.js");
const { FileExtensionDetector } = require("../dist/dependency/capture/detect/detector.js");
const { DefaultParserRegistry } = require("../dist/dependency/capture/registry/registry.js");
const { DefaultCaptureQueryRegistry } = require("../dist/dependency/capture/query/registry.js");
const { NullParserAdapter } = require("../dist/dependency/capture/adapter/null-adapter.js");

const FIXTURES_DIR = path.resolve(__dirname, "fixtures/tree-sitter");
const WASM_PATH = path.join(FIXTURES_DIR, "tree-sitter-javascript.wasm");
const SAMPLE_JS_PATH = path.join(FIXTURES_DIR, "sample.js");
const INVALID_JS_PATH = path.join(FIXTURES_DIR, "invalid.js");

test("UniversalCaptureOrchestrator Test Suite", async (t) => {
	// Pre-initialize the tree-sitter adapter
	const tsAdapter = await TreeSitterParserAdapter.create({
		javascript: WASM_PATH
	});

	// Standard Setup Helpers
	function createStandardOrchestrator() {
		const detector = new FileExtensionDetector();
		const parserRegistry = new DefaultParserRegistry();
		const queryRegistry = new DefaultCaptureQueryRegistry();

		const jsProfile = {
			languageId: "javascript",
			extensions: [".js"],
			syntaxKinds: ["esm-import", "commonjs-require"],
			preferredAdapterId: "tree-sitter",
			bareBehavior: "external"
		};
		detector.registerProfile(jsProfile);

		parserRegistry.register(tsAdapter);
		queryRegistry.register(JAVASCRIPT_CAPTURE_QUERY);

		return {
			orchestrator: new UniversalCaptureOrchestrator(detector, parserRegistry, queryRegistry),
			detector,
			parserRegistry,
			queryRegistry,
			jsProfile
		};
	}

	await t.test("successful capture on sample.js", () => {
		const { orchestrator } = createStandardOrchestrator();
		const result = orchestrator.capture(SAMPLE_JS_PATH);

		assert.ok(result);
		assert.equal(result.sourceFile, SAMPLE_JS_PATH);
		assert.equal(result.sourceLanguage, "javascript");
		assert.equal(result.parseError, undefined);
		assert.equal(result.edges.length, 3);

		// Assert edge details
		assert.equal(result.edges[0].specifier, "./utils/fs");
		assert.equal(result.edges[0].kind, "import");
		assert.equal(result.edges[1].specifier, "path");
		assert.equal(result.edges[1].kind, "require");
		assert.equal(result.edges[2].specifier, "express");
		assert.equal(result.edges[2].kind, "import");
	});

	await t.test("source override capture", () => {
		const { orchestrator } = createStandardOrchestrator();
		const overrideSource = `
			import foo from 'bar';
			const local = require('./local');
		`;
		const result = orchestrator.capture(SAMPLE_JS_PATH, overrideSource);

		assert.ok(result);
		assert.equal(result.sourceFile, SAMPLE_JS_PATH);
		assert.equal(result.parseError, undefined);
		assert.equal(result.edges.length, 2);

		assert.equal(result.edges[0].specifier, "bar");
		assert.equal(result.edges[0].kind, "import");
		assert.equal(result.edges[1].specifier, "./local");
		assert.equal(result.edges[1].kind, "require");
	});

	await t.test("unhandled extension returns null", () => {
		const { orchestrator } = createStandardOrchestrator();
		const result = orchestrator.capture("main.py");
		assert.equal(result, null);
	});

	await t.test("read failure returns CaptureResult with parseError", () => {
		const { orchestrator } = createStandardOrchestrator();
		// Passing a non-existent file path
		const result = orchestrator.capture(path.join(FIXTURES_DIR, "non-existent-file.js"));

		assert.ok(result);
		assert.equal(result.edges.length, 0);
		assert.ok(result.parseError.includes("Failed to read file"));
	});

	await t.test("missing parser adapter returns CaptureResult with parseError", () => {
		const { orchestrator, detector } = createStandardOrchestrator();
		
		// Register a python profile but no python parser adapter is registered
		const pythonProfile = {
			languageId: "python",
			extensions: [".py"],
			syntaxKinds: [],
			preferredAdapterId: "tree-sitter-python"
		};
		detector.registerProfile(pythonProfile);

		const result = orchestrator.capture("main.py");
		assert.ok(result);
		assert.equal(result.edges.length, 0);
		assert.equal(result.parseError, "No parser adapter registered for language: python");
	});

	await t.test("missing query returns CaptureResult with parseError", () => {
		const { detector, parserRegistry, queryRegistry } = createStandardOrchestrator();
		
		// Let's create an orchestrator with parser registered but query omitted
		const customQueryRegistry = new DefaultCaptureQueryRegistry(); // Empty!
		const orchestrator = new UniversalCaptureOrchestrator(detector, parserRegistry, customQueryRegistry);

		const result = orchestrator.capture(SAMPLE_JS_PATH);
		assert.ok(result);
		assert.equal(result.edges.length, 0);
		assert.equal(result.parseError, "No capture query registered for language: javascript");
	});

	await t.test("missing normalization table returns CaptureResult with parseError", () => {
		const { detector, parserRegistry } = createStandardOrchestrator();
		
		// Register a query without a normalizationTable
		const badQuery = {
			languageId: "javascript",
			adapterId: "tree-sitter",
			patterns: JAVASCRIPT_CAPTURE_QUERY.patterns,
			rawQuery: JAVASCRIPT_CAPTURE_QUERY.rawQuery
			// normalizationTable omitted!
		};
		const customQueryRegistry = new DefaultCaptureQueryRegistry();
		customQueryRegistry.register(badQuery);

		const orchestrator = new UniversalCaptureOrchestrator(detector, parserRegistry, customQueryRegistry);
		const result = orchestrator.capture(SAMPLE_JS_PATH);

		assert.ok(result);
		assert.equal(result.edges.length, 0);
		assert.equal(result.parseError, "Missing normalizationTable in capture query for language: javascript");
	});

	await t.test("affinity mismatch throws", () => {
		const { detector, parserRegistry } = createStandardOrchestrator();
		
		// Register a query that lists adapterId as 'regex' instead of 'tree-sitter'
		const mismatchedQuery = {
			languageId: "javascript",
			adapterId: "regex",
			patterns: JAVASCRIPT_CAPTURE_QUERY.patterns,
			rawQuery: JAVASCRIPT_CAPTURE_QUERY.rawQuery,
			normalizationTable: JAVASCRIPT_CAPTURE_QUERY.normalizationTable
		};
		const customQueryRegistry = new DefaultCaptureQueryRegistry();
		customQueryRegistry.register(mismatchedQuery);

		const orchestrator = new UniversalCaptureOrchestrator(detector, parserRegistry, customQueryRegistry);
		
		assert.throws(() => {
			orchestrator.capture(SAMPLE_JS_PATH);
		}, /Affinity mismatch/);
	});

	await t.test("parser returning null returns CaptureResult with parseError", () => {
		const detector = new FileExtensionDetector();
		const parserRegistry = new DefaultParserRegistry();
		const queryRegistry = new DefaultCaptureQueryRegistry();

		const jsProfile = {
			languageId: "javascript",
			extensions: [".js"],
			syntaxKinds: [],
			preferredAdapterId: "null"
		};
		detector.registerProfile(jsProfile);

		// NullParserAdapter returns null from parse()
		const nullAdapter = new NullParserAdapter(["javascript"]);
		parserRegistry.register(nullAdapter);

		queryRegistry.register({
			languageId: "javascript",
			adapterId: "null",
			patterns: [],
			normalizationTable: {}
		});

		const orchestrator = new UniversalCaptureOrchestrator(detector, parserRegistry, queryRegistry);
		const result = orchestrator.capture(SAMPLE_JS_PATH);

		assert.ok(result);
		assert.equal(result.edges.length, 0);
		assert.equal(result.parseError, "Parser returned null tree");
	});

	await t.test("syntax-error file still extracts edges and sets parseError", () => {
		const { orchestrator } = createStandardOrchestrator();
		const result = orchestrator.capture(INVALID_JS_PATH);

		assert.ok(result);
		assert.equal(result.sourceFile, INVALID_JS_PATH);
		assert.equal(result.sourceLanguage, "javascript");
		assert.equal(result.parseError, "Document contains syntax errors");
		
		// Should still retrieve the valid imports before the syntax error
		assert.equal(result.edges.length, 3);
		assert.equal(result.edges[0].specifier, "./utils/fs");
		assert.equal(result.edges[1].specifier, "path");
		assert.equal(result.edges[2].specifier, "express");
	});
});
