// @ts-nocheck
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { UniversalCaptureOrchestrator } = require("../dist/dependency/capture/orchestrator.js");
const { TreeSitterParserAdapter } = require("../dist/dependency/capture/adapter/tree-sitter/index.js");
const { TYPESCRIPT_CAPTURE_QUERY } = require("../dist/dependency/capture/adapter/tree-sitter/queries/typescript.js");
const { TSX_CAPTURE_QUERY } = require("../dist/dependency/capture/adapter/tree-sitter/queries/tsx.js");
const { FileExtensionDetector } = require("../dist/dependency/capture/detect/detector.js");
const { DefaultParserRegistry } = require("../dist/dependency/capture/registry/registry.js");
const { DefaultCaptureQueryRegistry } = require("../dist/dependency/capture/query/registry.js");
const { TYPESCRIPT_PROFILE } = require("../dist/dependency/capture/profiles/typescript.js");
const { TSX_PROFILE } = require("../dist/dependency/capture/profiles/tsx.js");

const TS_WASM = path.resolve(__dirname, "fixtures/tree-sitter/tree-sitter-typescript.wasm");
const TSX_WASM = path.resolve(__dirname, "fixtures/tree-sitter/tree-sitter-tsx.wasm");

async function setupOrchestrator() {
	const tsAdapter = await TreeSitterParserAdapter.create({
		typescript: TS_WASM,
		tsx: TSX_WASM
	});

	const detector = new FileExtensionDetector();
	detector.registerProfile(TYPESCRIPT_PROFILE);
	detector.registerProfile(TSX_PROFILE);

	const parserRegistry = new DefaultParserRegistry();
	parserRegistry.register(tsAdapter);

	const queryRegistry = new DefaultCaptureQueryRegistry();
	queryRegistry.register(TYPESCRIPT_CAPTURE_QUERY);
	queryRegistry.register(TSX_CAPTURE_QUERY);

	return new UniversalCaptureOrchestrator(detector, parserRegistry, queryRegistry);
}

test("TS/TSX Capture: Static, Type-Only & Side-Effect Imports", async () => {
	const orchestrator = await setupOrchestrator();
	const code = `import { a } from "./a";
import type { b } from "./b";
import "./c";`;

	const result = orchestrator.capture("sample.ts", code);
	assert.ok(result);
	assert.equal(result.sourceLanguage, "typescript");
	assert.equal(result.edges.length, 3);

	assert.deepEqual(result.edges[0], {
		specifier: "./a",
		kind: "import",
		sourceFile: "sample.ts",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		position: { line: 1, column: 19 },
		isDynamic: false
	});

	assert.deepEqual(result.edges[1], {
		specifier: "./b",
		kind: "import",
		sourceFile: "sample.ts",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		position: { line: 2, column: 24 },
		isDynamic: false
	});

	assert.deepEqual(result.edges[2], {
		specifier: "./c",
		kind: "import",
		sourceFile: "sample.ts",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		position: { line: 3, column: 8 },
		isDynamic: false
	});
});

test("TS/TSX Capture: Re-exports & Type-Only Re-exports", async () => {
	const orchestrator = await setupOrchestrator();
	const code = `export { d } from "./d";
export type { e } from "./e";
export * from "./f";`;

	const result = orchestrator.capture("sample.ts", code);
	assert.ok(result);
	assert.equal(result.edges.length, 3);

	assert.equal(result.edges[0].specifier, "./d");
	assert.equal(result.edges[0].syntaxKind, "esm-export");

	assert.equal(result.edges[1].specifier, "./e");
	assert.equal(result.edges[1].syntaxKind, "esm-export");

	assert.equal(result.edges[2].specifier, "./f");
	assert.equal(result.edges[2].syntaxKind, "esm-export");
});

test("TS/TSX Capture: CommonJS require & Dynamic Import", async () => {
	const orchestrator = await setupOrchestrator();
	const code = `const g = require("./g");
const h = import("./h");`;

	const result = orchestrator.capture("sample.ts", code);
	assert.ok(result);
	assert.equal(result.edges.length, 2);

	assert.deepEqual(result.edges[0], {
		specifier: "./g",
		kind: "require",
		sourceFile: "sample.ts",
		sourceLanguage: "typescript",
		syntaxKind: "commonjs-require",
		position: { line: 1, column: 19 },
		isDynamic: false
	});

	assert.deepEqual(result.edges[1], {
		specifier: "./h",
		kind: "import",
		sourceFile: "sample.ts",
		sourceLanguage: "typescript",
		syntaxKind: "dynamic-import",
		position: { line: 2, column: 18 },
		isDynamic: true
	});
});

test("TS/TSX Capture: TS Import Equals Require", async () => {
	const orchestrator = await setupOrchestrator();
	const code = `import i = require("./i");`;

	const result = orchestrator.capture("sample.ts", code);
	assert.ok(result);
	assert.equal(result.edges.length, 1);

	assert.deepEqual(result.edges[0], {
		specifier: "./i",
		kind: "import",
		sourceFile: "sample.ts",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		position: { line: 1, column: 20 },
		isDynamic: false
	});
});

test("TS/TSX Capture: TSX JSX Elements parsing", async () => {
	const orchestrator = await setupOrchestrator();
	const code = `import { Button } from "./Button";
const App = () => <Button label="click" />;`;

	const result = orchestrator.capture("sample.tsx", code);
	assert.ok(result);
	assert.equal(result.sourceLanguage, "tsx");
	assert.equal(result.edges.length, 1);
	assert.equal(result.edges[0].specifier, "./Button");
});

test("TS/TSX Capture: Declaration File (.d.ts) static imports", async () => {
	const orchestrator = await setupOrchestrator();
	const code = `import { Helper } from "./helper";
export type MyType = string;`;

	const result = orchestrator.capture("types.d.ts", code);
	assert.ok(result);
	assert.equal(result.sourceLanguage, "typescript");
	assert.equal(result.edges.length, 1);
	assert.equal(result.edges[0].specifier, "./helper");
});
