// @ts-nocheck
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
const { indexWorkspace } = require("../dist/dependency/workspace/index.js");
const { UniversalResolver } = require("../dist/dependency/resolve/resolver.js");

const { compareJsFile } = require("./support/comparison/compare-engines.js");

const FIXTURES_DIR = path.resolve(__dirname, "fixtures/comparison");
const WASM_PATH = path.resolve(__dirname, "fixtures/tree-sitter/tree-sitter-javascript.wasm");

test("Comparison Harness Test Suite", async (t) => {
	// Initialize tree-sitter adapter
	const tsAdapter = await TreeSitterParserAdapter.create({
		javascript: WASM_PATH
	});

	const detector = new FileExtensionDetector();
	const parserRegistry = new DefaultParserRegistry();
	const queryRegistry = new DefaultCaptureQueryRegistry();

	const jsProfile = {
		languageId: "javascript",
		extensions: [".js"],
		syntaxKinds: ["esm-import", "commonjs-require"],
		preferredAdapterId: "tree-sitter",
		bareBehavior: "external",
		extensionPriorityGroups: [[".js"], [".jsx"]],
		sourceEquivMap: {}
	};
	detector.registerProfile(jsProfile);
	parserRegistry.register(tsAdapter);
	queryRegistry.register(JAVASCRIPT_CAPTURE_QUERY);

	const orchestrator = new UniversalCaptureOrchestrator(detector, parserRegistry, queryRegistry);

	console.log(`Indexing comparison fixtures: ${FIXTURES_DIR}...`);
	const index = await indexWorkspace(FIXTURES_DIR, ["node_modules/**"]);
	const resolver = new UniversalResolver(index);

	const cfg = {
		root: FIXTURES_DIR,
		exclude: ["**/node_modules/**"],
		include: [],
		aliases: {}
	};

	await t.test("standard.js - identical capture and resolution", async () => {
		const filePath = path.join(FIXTURES_DIR, "standard.js");
		const report = await compareJsFile(filePath, cfg, orchestrator, resolver);

		assert.equal(report.legacyError, null);
		assert.equal(report.universalError, null);
		assert.equal(report.category, "universal-only");

		// Sibling helper import
		const helperEdge = report.edges.find(e => e.specifier === "./helper");
		assert.ok(helperEdge);
		assert.equal(helperEdge.category, "same");
		assert.equal(helperEdge.legacyCaptured, true);
		assert.equal(helperEdge.universalCaptured, true);
		assert.ok(helperEdge.legacyResolved.endsWith("helper.js"));
		assert.ok(helperEdge.universalResolved.endsWith("helper.js"));

		// Directory nested index import
		const nestedEdge = report.edges.find(e => e.specifier === "./nested");
		assert.ok(nestedEdge);
		assert.equal(nestedEdge.category, "same");
		assert.ok(nestedEdge.legacyResolved.replace(/\\/g, "/").endsWith("nested/index.js"));
		assert.ok(nestedEdge.universalResolved.replace(/\\/g, "/").endsWith("nested/index.js"));

		// Standard CJS require for external system modules and bare imports
		const fsEdge = report.edges.find(e => e.specifier === "fs");
		assert.ok(fsEdge);
		assert.equal(fsEdge.category, "universal-only");
		assert.equal(fsEdge.universalStatus, "external");
	});

	await t.test("unresolved.js - matching unresolved outcomes", async () => {
		const filePath = path.join(FIXTURES_DIR, "unresolved.js");
		const report = await compareJsFile(filePath, cfg, orchestrator, resolver);

		assert.equal(report.legacyError, null);
		assert.equal(report.category, "universal-only");

		const missingEdge = report.edges.find(e => e.specifier === "./non-existent");
		assert.ok(missingEdge);
		assert.equal(missingEdge.category, "both-unresolved");
		assert.equal(missingEdge.legacyResolved, null);
		assert.equal(missingEdge.universalResolved, null);
	});

	await t.test("syntax-error.js - syntax error triggers universal-error status but extracts valid imports", async () => {
		const filePath = path.join(FIXTURES_DIR, "syntax-error.js");
		const report = await compareJsFile(filePath, cfg, orchestrator, resolver);

		assert.equal(report.category, "universal-error");
		assert.ok(report.universalError);
		assert.ok(report.universalError.includes("syntax"));

		// Should still partially recover and extract valid imports before/after the error
		const helperEdge = report.edges.find(e => e.specifier === "./helper");
		assert.ok(helperEdge);
		assert.equal(helperEdge.legacyCaptured, true);
		assert.equal(helperEdge.universalCaptured, true);
	});

	await t.test("edge-cases.js - commented out and in-string fake imports are ignored", async () => {
		const filePath = path.join(FIXTURES_DIR, "edge-cases.js");
		const report = await compareJsFile(filePath, cfg, orchestrator, resolver);

		assert.equal(report.category, "same");

		const commented1 = report.edges.find(e => e.specifier.includes("commented-helper"));
		assert.equal(commented1, undefined);

		const inString = report.edges.find(e => e.specifier.includes("in-string"));
		assert.equal(inString, undefined);

		const helperEdge = report.edges.find(e => e.specifier === "./helper");
		assert.ok(helperEdge);
		assert.equal(helperEdge.category, "same");
	});
});
