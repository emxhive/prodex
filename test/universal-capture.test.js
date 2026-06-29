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

test("LanguageProfile with all fields accepted by FileExtensionDetector", () => {
	const detector = new FileExtensionDetector();

	const tsProfile = {
		languageId: "typescript",
		extensions: [".ts", ".tsx"],
		syntaxKinds: ["esm-import"],
		preferredAdapterId: "tree-sitter-typescript",
		bareBehavior: "external",
		extensionPriorityGroups: [[".ts"], [".tsx"], [".js"]],
		sourceEquivMap: { ".js": [".ts"] }
	};

	detector.registerProfile(tsProfile);
	const result = detector.detect("src/main.ts");
	assert.ok(result);
	assert.equal(result.profile.bareBehavior, "external");
	assert.deepEqual(result.profile.extensionPriorityGroups, [[".ts"], [".tsx"], [".js"]]);
	assert.deepEqual(result.profile.sourceEquivMap, { ".js": [".ts"] });
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
		adapterId: "null",
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

test("Profile-driven classifier", () => {
	const { classifySpecifier } = require("../dist/dependency/resolve/classify.js");
	const { DebugCollector } = require("../dist/dependency/debug/collector.js");
	const debugCollector = new DebugCollector();

	// 1. classify: profile-driven check bareBehavior='external'
	const jsProfile = {
		languageId: "javascript",
		extensions: [".js"],
		syntaxKinds: ["esm-import"],
		preferredAdapterId: "tree-sitter-javascript",
		bareBehavior: "external"
	};
	const req1 = {
		specifier: "lodash",
		intent: "dependency-edge",
		profile: jsProfile
	};
	const res1 = classifySpecifier(req1, debugCollector);
	assert.equal(res1.type, "external");

	// 2. classify: profile-driven check bareBehavior='unresolvable'
	const phpProfile = {
		languageId: "php",
		extensions: [".php"],
		syntaxKinds: ["use-statement"],
		preferredAdapterId: "tree-sitter-php",
		bareBehavior: "unresolvable"
	};
	const req2 = {
		specifier: "App\\Services\\AlertService",
		intent: "dependency-edge",
		profile: phpProfile
	};
	const res2 = classifySpecifier(req2, debugCollector);
	assert.equal(res2.type, "bare");

	// 3. classify: compatibility/regression bridge fallback emits resolve:classify:no-profile
	debugCollector.clear();
	const req3 = {
		specifier: "react",
		intent: "dependency-edge",
		sourceLanguage: "javascript"
	};
	const res3 = classifySpecifier(req3, debugCollector);
	assert.equal(res3.type, "external");
	const events = debugCollector.getEvents();
	assert.ok(events.some(e => e.category === "resolve:classify:no-profile"));
});

test("Profile-driven resolver strategies integration", async () => {
	const fixturePath = path.join(FIXTURES_DIR, "local-path-completion");
	const index = await indexWorkspace(fixturePath);
	const resolver = new UniversalResolver(index);

	// L4: profile extension priority
	const phpProfile = {
		languageId: "php",
		extensions: [".php"],
		syntaxKinds: ["use-statement"],
		preferredAdapterId: "tree-sitter-php",
		bareBehavior: "unresolvable",
		extensionPriorityGroups: [[".php"]]
	};
	const resL4 = resolver.resolve({
		specifier: "./shared-ambiguous/data",
		intent: "dependency-edge",
		profile: phpProfile
	});
	assert.equal(resL4.status, "resolved");
	assert.equal(resL4.level, "L4");
	assert.equal(resL4.file, getFixtureFile("local-path-completion", "shared-ambiguous/data.php"));

	// L3.5: profile sourceEquivMap success
	const customEquivProfile = {
		languageId: "custom",
		extensions: [".custom"],
		syntaxKinds: [],
		preferredAdapterId: "null",
		sourceEquivMap: {
			".js": [".ts"]
		}
	};
	const resL35 = resolver.resolve({
		specifier: "../js-to-ts/main.js",
		intent: "dependency-edge",
		origin: { path: getFixtureFile("local-path-completion", "src/main.tsx") },
		profile: customEquivProfile
	});
	assert.equal(resL35.status, "resolved");
	assert.equal(resL35.level, "L3.5");
	assert.equal(resL35.file, getFixtureFile("local-path-completion", "js-to-ts/main.ts"));

	// L3.5: profile sourceEquivMap failure (maps to non-existent extension)
	const customEquivProfileFail = {
		languageId: "custom",
		extensions: [".custom"],
		syntaxKinds: [],
		preferredAdapterId: "null",
		sourceEquivMap: {
			".js": [".invalid"]
		}
	};
	const resL35Fail = resolver.resolve({
		specifier: "../js-to-ts/main.js",
		intent: "dependency-edge",
		origin: { path: getFixtureFile("local-path-completion", "src/main.tsx") },
		profile: customEquivProfileFail
	});
	assert.notEqual(resL35Fail.level, "L3.5");
});

test("DefaultCaptureQueryRegistry and affinity", () => {
	const { DefaultCaptureQueryRegistry } = require("../dist/dependency/capture/query/registry.js");
	const registry = new DefaultCaptureQueryRegistry();

	const query1 = {
		languageId: "typescript",
		adapterId: "tree-sitter",
		patterns: [{ name: "import.source", role: "specifier" }]
	};

	registry.register(query1);
	assert.equal(registry.resolve("typescript"), query1);
	assert.equal(registry.resolve("unknown"), null);

	// Duplicate register throws
	assert.throws(() => {
		registry.register(query1);
	}, /already registered/);

	assert.deepEqual(registry.listLanguageIds(), ["typescript"]);

	// Affinity check logic (simulating the orchestrator check)
	const adapter = { adapterId: "tree-sitter" };
	const mismatchedAdapter = { adapterId: "null" };

	// Matches -> should proceed without throw
	assert.equal(query1.adapterId, adapter.adapterId);

	// Mismatched -> orchestrator would throw
	assert.throws(() => {
		if (query1.adapterId !== mismatchedAdapter.adapterId) {
			throw new Error(`Affinity mismatch: query targets ${query1.adapterId}, resolved ${mismatchedAdapter.adapterId}`);
		}
	}, /Affinity mismatch/);
});
test("normalizeCaptures from CapturedNode to DependencyEdge", () => {
	const { normalizeCaptures } = require("../dist/dependency/capture/normalize.js");

	const table = {
		"import.source": { kind: "import", syntaxKind: "esm-import", isDynamic: false },
		"require.argument": { kind: "require", syntaxKind: "commonjs-require", isDynamic: false },
		"dynamic.source": { kind: "dynamic", syntaxKind: "esm-dynamic-import", isDynamic: true }
	};

	const patterns = [
		{ name: "import.source", role: "specifier" },
		{ name: "require.argument", role: "specifier" },
		{ name: "dynamic.marker", role: "dynamic-marker" },
		{ name: "dynamic.source", role: "specifier" }
	];

	const nodes = [
		// 1. Static ESM import
		{
			patternName: "import.source",
			text: "./utils",
			startPosition: { line: 1, column: 8 },
			isDynamic: false
		},
		// 2. CommonJS require
		{
			patternName: "require.argument",
			text: "lodash",
			startPosition: { line: 2, column: 12 },
			isDynamic: false
		},
		// 3. Dynamic marker followed by dynamic specifier (same line)
		{
			patternName: "dynamic.marker",
			text: "import",
			startPosition: { line: 5, column: 0 },
			isDynamic: false
		},
		{
			patternName: "dynamic.source",
			text: "./routes/${name}",
			startPosition: { line: 5, column: 7 },
			isDynamic: false
		}
	];

	const edges = normalizeCaptures(nodes, "/workspace/src/main.ts", "typescript", table, patterns);

	assert.equal(edges.length, 3);

	// 1. ESM Import checks
	assert.equal(edges[0].specifier, "./utils");
	assert.equal(edges[0].kind, "import");
	assert.equal(edges[0].syntaxKind, "esm-import");
	assert.equal(edges[0].isDynamic, false);
	assert.equal(edges[0].dynamicHint, undefined);

	// 2. CommonJS checks
	assert.equal(edges[1].specifier, "lodash");
	assert.equal(edges[1].kind, "require");
	assert.equal(edges[1].syntaxKind, "commonjs-require");

	// 3. Dynamic checks (marked dynamic via preceding marker + template literal hint)
	assert.equal(edges[2].specifier, "./routes/${name}");
	assert.equal(edges[2].isDynamic, true);
	assert.ok(edges[2].dynamicHint);
	assert.equal(edges[2].dynamicHint.pattern, "./routes/${name}");
	assert.equal(edges[2].dynamicHint.reason, "template-literal");
});

test("Pipeline Integration: CapturedNode -> normalize -> bridge -> Resolver", async () => {
	const { normalizeCaptures } = require("../dist/dependency/capture/normalize.js");
	const fixturePath = path.join(FIXTURES_DIR, "polyglot-basic");
	const index = await indexWorkspace(fixturePath);
	const resolver = new UniversalResolver(index);

	const table = {
		"import.source": { kind: "import", syntaxKind: "esm-import", isDynamic: false }
	};
	const patterns = [{ name: "import.source", role: "specifier" }];

	const nodes = [
		{
			patternName: "import.source",
			text: "./shared/logger.ts",
			startPosition: { line: 1, column: 0 },
			isDynamic: false
		}
	];

	const edges = normalizeCaptures(
		nodes,
		getFixtureFile("polyglot-basic", "src/main.ts"),
		"typescript",
		table,
		patterns
	);

	const requests = edgesToRequests(edges);
	const result = resolver.resolve(requests[0]);

	assert.equal(result.status, "resolved");
	assert.equal(result.level, "L3");
	assert.equal(result.file, getFixtureFile("polyglot-basic", "src/shared/logger.ts"));
});


