const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { FileExtensionDetector } = require("../dist/dependency/capture/detect/detector.js");
const { NullParserAdapter } = require("../dist/dependency/capture/adapter/null-adapter.js");
const { DefaultParserRegistry } = require("../dist/dependency/capture/registry/registry.js");
const { edgesToRequests } = require("../dist/dependency/capture/bridge.js");
const { indexWorkspace } = require("../dist/dependency/workspace/index.js");
const { UniversalResolver } = require("../dist/dependency/resolve/resolver.js");

const FIXTURES_DIR = path.resolve(__dirname, "fixtures/universal-resolution");

function getFixtureFile(fixture, relPath) {
	return path.join(FIXTURES_DIR, fixture, relPath).replace(/\\/g, "/");
}

test("FileExtensionDetector with explicitly registered profiles", () => {
	const detector = new FileExtensionDetector();

	const tsProfile = {
		languageId: "typescript",
		extensions: [".ts", ".tsx", ".d.ts"],
		syntaxKinds: ["esm-import"],
		preferredAdapterId: "tree-sitter-typescript"
	};

	const phpProfile = {
		languageId: "php",
		extensions: [".php"],
		syntaxKinds: ["use-statement"],
		preferredAdapterId: "tree-sitter-php"
	};

	detector.registerProfile(tsProfile);
	detector.registerProfile(phpProfile);

	// Basic extensions
	const tsResult = detector.detect("src/main.ts");
	assert.ok(tsResult);
	assert.equal(tsResult.languageId, "typescript");
	assert.equal(tsResult.confidence, "high");
	assert.equal(tsResult.method, "extension");

	const phpResult = detector.detect("index.php");
	assert.ok(phpResult);
	assert.equal(phpResult.languageId, "php");

	// Longest match (multi-dot extensions)
	const dtsResult = detector.detect("types.d.ts");
	assert.ok(dtsResult);
	assert.equal(dtsResult.languageId, "typescript");
	assert.deepEqual(dtsResult.profile, tsProfile);

	// Unregistered / unknown extension
	const unknownResult = detector.detect("main.py");
	assert.equal(unknownResult, null);
});

test("DefaultParserRegistry", () => {
	const registry = new DefaultParserRegistry();
	
	const adapter1 = new NullParserAdapter(["typescript", "javascript"]);
	// Override the ID for uniqueness in test if needed, but it defaults to 'null'.
	// To test duplicate ID registry, we can instantiate adapters with same ID.
	assert.equal(adapter1.adapterId, "null");

	registry.register(adapter1);

	// Resolve registered languages
	assert.equal(registry.resolve("typescript"), adapter1);
	assert.equal(registry.resolve("javascript"), adapter1);
	assert.equal(registry.resolve("unknown"), null);

	// Duplicate adapter registration throws
	const adapter2 = new NullParserAdapter(["php"]);
	assert.throws(() => {
		registry.register(adapter2);
	}, /already registered/);

	// List adapter IDs
	assert.deepEqual(registry.listAdapterIds(), ["null"]);
});

test("NullParserAdapter", () => {
	const adapter = new NullParserAdapter(["typescript"]);
	assert.deepEqual(adapter.supportedLanguages, ["typescript"]);

	const parseResult = adapter.parse("main.ts", "import { x } from 'y';", "typescript");
	assert.equal(parseResult, null);

	// Verify runQuery returns empty array
	const dummyDoc = {
		tree: {},
		sourceFile: "main.ts",
		sourceLanguage: "typescript",
		source: "import { x } from 'y';"
	};
	const query = {
		languageId: "typescript",
		patterns: []
	};
	assert.deepEqual(adapter.runQuery(dummyDoc, query), []);
});

test("edgesToRequests bridge", () => {
	const edges = [
		{
			specifier: "./utils",
			kind: "import",
			sourceFile: "/workspace/src/main.ts",
			sourceLanguage: "typescript",
			syntaxKind: "esm-import",
			position: { line: 1, column: 8 }
		},
		{
			specifier: "lodash",
			kind: "import",
			sourceFile: "/workspace/src/main.ts",
			sourceLanguage: "typescript",
			syntaxKind: "esm-import"
		}
	];

	const requests = edgesToRequests(edges);
	assert.equal(requests.length, 2);

	// Check mapping of first request
	assert.equal(requests[0].specifier, "./utils");
	assert.equal(requests[0].intent, "dependency-edge");
	assert.equal(requests[0].sourceFile, "/workspace/src/main.ts");
	assert.equal(requests[0].sourceLanguage, "typescript");
	assert.equal(requests[0].syntaxKind, "esm-import");
	assert.deepEqual(requests[0].origin, {
		path: "/workspace/src/main.ts",
		position: { line: 1, column: 8 }
	});

	// Check mapping of second request (no position)
	assert.equal(requests[1].specifier, "lodash");
	assert.equal(requests[1].intent, "dependency-edge");
	assert.equal(requests[1].sourceFile, "/workspace/src/main.ts");
	assert.equal(requests[1].sourceLanguage, "typescript");
	assert.equal(requests[1].syntaxKind, "esm-import");
	assert.deepEqual(requests[1].origin, {
		path: "/workspace/src/main.ts"
	});

	// Check overriding intent
	const requestsCustomIntent = edgesToRequests(edges, "seed-entry");
	assert.equal(requestsCustomIntent[0].intent, "seed-entry");
});

test("Integration: bridge -> UniversalResolver with polyglot-basic fixture", async () => {
	const fixturePath = path.join(FIXTURES_DIR, "polyglot-basic");
	const index = await indexWorkspace(fixturePath);
	const resolver = new UniversalResolver(index);

	const sourceFile = getFixtureFile("polyglot-basic", "src/main.ts");

	const edges = [
		// 1. Relative path to existing file (extensionless, resolves at L4)
		{
			specifier: "./shared/logger",
			kind: "import",
			sourceFile,
			sourceLanguage: "typescript",
			syntaxKind: "esm-import"
		},
		// 2. Relative path to existing file (exact path, resolves at L3)
		{
			specifier: "./shared/logger.ts",
			kind: "import",
			sourceFile,
			sourceLanguage: "typescript",
			syntaxKind: "esm-import"
		},
		// 3. External library (resolves at L1)
		{
			specifier: "lodash",
			kind: "import",
			sourceFile,
			sourceLanguage: "typescript",
			syntaxKind: "esm-import"
		},
		// 4. Dynamic import that matches existing dynamic classification (string-based, resolves at LX)
		{
			specifier: "./routes/${name}",
			kind: "dynamic",
			sourceFile,
			sourceLanguage: "typescript",
			syntaxKind: "esm-import"
		}
	];

	const requests = edgesToRequests(edges);
	const results = requests.map(req => resolver.resolve(req));

	// Assert relative path (extensionless) resolved at L4
	assert.equal(results[0].status, "resolved");
	assert.equal(results[0].level, "L4");
	assert.equal(results[0].file, getFixtureFile("polyglot-basic", "src/shared/logger.ts"));

	// Assert relative path (exact) resolved at L3
	assert.equal(results[1].status, "resolved");
	assert.equal(results[1].level, "L3");
	assert.equal(results[1].file, getFixtureFile("polyglot-basic", "src/shared/logger.ts"));

	// Assert external resolved as external at L1
	assert.equal(results[2].status, "external");
	assert.equal(results[2].level, "L1");

	// Assert dynamic resolved as unresolved LX (unresolved-dynamic)
	assert.equal(results[3].status, "unresolved");
	assert.equal(results[3].level, "LX");
	assert.equal(results[3].strategy, "unresolved-dynamic");
});
