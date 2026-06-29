const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const fs = require("node:fs");

const { TreeSitterParserAdapter } = require("../dist/dependency/capture/adapter/tree-sitter/index.js");
const { JAVASCRIPT_CAPTURE_QUERY, JAVASCRIPT_NORMALIZATION_TABLE } = require("../dist/dependency/capture/adapter/tree-sitter/queries/javascript.js");
const { FileExtensionDetector } = require("../dist/dependency/capture/detect/detector.js");
const { DefaultParserRegistry } = require("../dist/dependency/capture/registry/registry.js");
const { DefaultCaptureQueryRegistry } = require("../dist/dependency/capture/query/registry.js");
const { normalizeCaptures } = require("../dist/dependency/capture/normalize.js");
const { edgesToRequests } = require("../dist/dependency/capture/bridge.js");
const { indexWorkspace } = require("../dist/dependency/workspace/index.js");
const { UniversalResolver } = require("../dist/dependency/resolve/resolver.js");

const FIXTURES_DIR = path.resolve(__dirname, "fixtures/tree-sitter");
const WASM_PATH = path.join(FIXTURES_DIR, "tree-sitter-javascript.wasm");
const SAMPLE_JS_PATH = path.join(FIXTURES_DIR, "sample.js");
const UTILS_FS_JS_PATH = path.join(FIXTURES_DIR, "utils/fs.js").replace(/\\/g, "/");

test("Tree-sitter Adapter Proof Slice Test Suite", async (t) => {
	// Pre-initialize the adapter once for the suite
	const adapter = await TreeSitterParserAdapter.create({
		javascript: WASM_PATH
	});

	await t.test("Unit: adapter parse", () => {
		const source = fs.readFileSync(SAMPLE_JS_PATH, "utf8");
		const doc = adapter.parse(SAMPLE_JS_PATH, source, "javascript");

		assert.ok(doc);
		assert.equal(doc.sourceFile, SAMPLE_JS_PATH);
		assert.equal(doc.sourceLanguage, "javascript");
		assert.equal(doc.hasErrors, false);
		assert.ok(doc.tree);
	});

	await t.test("Unit: adapter runQuery", () => {
		const source = fs.readFileSync(SAMPLE_JS_PATH, "utf8");
		const doc = adapter.parse(SAMPLE_JS_PATH, source, "javascript");
		assert.ok(doc);

		const captures = adapter.runQuery(doc, JAVASCRIPT_CAPTURE_QUERY);

		// Expecting:
		// 1. import.source -> ./utils/fs
		// 2. _req -> require (ignored in normalization but captured)
		// 3. require.argument -> path
		// 4. import.source -> express
		const relevantCaptures = captures.filter(c => c.patternName !== "_req");
		assert.equal(relevantCaptures.length, 3);

		assert.equal(relevantCaptures[0].patternName, "import.source");
		assert.equal(relevantCaptures[0].text, "./utils/fs");
		assert.equal(relevantCaptures[0].startPosition.line, 1);

		assert.equal(relevantCaptures[1].patternName, "require.argument");
		assert.equal(relevantCaptures[1].text, "path");
		assert.equal(relevantCaptures[1].startPosition.line, 2);

		assert.equal(relevantCaptures[2].patternName, "import.source");
		assert.equal(relevantCaptures[2].text, "express");
		assert.equal(relevantCaptures[2].startPosition.line, 3);
	});

	await t.test("Unit: normalizeCaptures", () => {
		const source = fs.readFileSync(SAMPLE_JS_PATH, "utf8");
		const doc = adapter.parse(SAMPLE_JS_PATH, source, "javascript");
		assert.ok(doc);

		const captures = adapter.runQuery(doc, JAVASCRIPT_CAPTURE_QUERY);
		const edges = normalizeCaptures(
			captures,
			SAMPLE_JS_PATH,
			"javascript",
			JAVASCRIPT_NORMALIZATION_TABLE,
			JAVASCRIPT_CAPTURE_QUERY.patterns
		);

		assert.equal(edges.length, 3);

		assert.deepEqual(edges[0], {
			specifier: "./utils/fs",
			kind: "import",
			sourceFile: SAMPLE_JS_PATH,
			sourceLanguage: "javascript",
			syntaxKind: "esm-import",
			position: { line: 1, column: 27 },
			isDynamic: false
		});

		assert.deepEqual(edges[1], {
			specifier: "path",
			kind: "require",
			sourceFile: SAMPLE_JS_PATH,
			sourceLanguage: "javascript",
			syntaxKind: "commonjs-require",
			position: { line: 2, column: 22 },
			isDynamic: false
		});

		assert.deepEqual(edges[2], {
			specifier: "express",
			kind: "import",
			sourceFile: SAMPLE_JS_PATH,
			sourceLanguage: "javascript",
			syntaxKind: "esm-import",
			position: { line: 3, column: 21 },
			isDynamic: false
		});
	});

	await t.test("Integration: full pipeline from detect to resolve", async () => {
		// 1. Setup Detector with JS profile
		const detector = new FileExtensionDetector();
		const jsProfile = {
			languageId: "javascript",
			extensions: [".js"],
			syntaxKinds: ["esm-import", "commonjs-require"],
			preferredAdapterId: "tree-sitter",
			bareBehavior: "external",
			extensionPriorityGroups: [[".js"]],
			sourceEquivMap: {}
		};
		detector.registerProfile(jsProfile);

		// 2. Setup Registries
		const parserRegistry = new DefaultParserRegistry();
		parserRegistry.register(adapter);

		const queryRegistry = new DefaultCaptureQueryRegistry();
		queryRegistry.register(JAVASCRIPT_CAPTURE_QUERY);

		// 3. Workspace Index & Universal Resolver
		const index = await indexWorkspace(FIXTURES_DIR);
		const resolver = new UniversalResolver(index);

		// 4. Executing pipeline
		// A. Detect
		const detection = detector.detect(SAMPLE_JS_PATH);
		assert.ok(detection);
		assert.equal(detection.languageId, "javascript");
		assert.deepEqual(detection.profile, jsProfile);

		// B. Resolve parser and query
		const resolvedAdapter = parserRegistry.resolve(detection.languageId);
		assert.ok(resolvedAdapter);
		assert.equal(resolvedAdapter.adapterId, "tree-sitter");

		const resolvedQuery = queryRegistry.resolve(detection.languageId);
		assert.ok(resolvedQuery);
		assert.equal(resolvedQuery.adapterId, resolvedAdapter.adapterId);

		// C. Parse & Query
		const source = fs.readFileSync(SAMPLE_JS_PATH, "utf8");
		const doc = resolvedAdapter.parse(SAMPLE_JS_PATH, source, detection.languageId);
		assert.ok(doc);

		const captures = resolvedAdapter.runQuery(doc, resolvedQuery);

		// D. Normalize to DependencyEdge
		const edges = normalizeCaptures(
			captures,
			SAMPLE_JS_PATH,
			detection.languageId,
			JAVASCRIPT_NORMALIZATION_TABLE,
			resolvedQuery.patterns
		);

		// E. Transform edges to resolution requests with the profile attached
		const requests = edgesToRequests(edges).map(req => ({
			...req,
			profile: detection.profile
		}));

		assert.equal(requests.length, 3);

		// F. Resolve each request using the UniversalResolver
		const results = requests.map(req => resolver.resolve(req));

		// Assert: ./utils/fs resolves locally (L4)
		assert.equal(results[0].status, "resolved");
		assert.equal(results[0].level, "L4");
		assert.equal(results[0].file, UTILS_FS_JS_PATH);

		// Assert: path resolves as external (L1)
		assert.equal(results[1].status, "external");
		assert.equal(results[1].level, "L1");

		// Assert: express resolves as external (L1)
		assert.equal(results[2].status, "external");
		assert.equal(results[2].level, "L1");
	});
});
