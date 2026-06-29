// @ts-nocheck
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { UniversalCaptureOrchestrator } = require("../dist/dependency/capture/orchestrator.js");
const { TreeSitterParserAdapter } = require("../dist/dependency/capture/adapter/tree-sitter/index.js");
const { PHP_CAPTURE_QUERY } = require("../dist/dependency/capture/adapter/tree-sitter/queries/php.js");
const { FileExtensionDetector } = require("../dist/dependency/capture/detect/detector.js");
const { DefaultParserRegistry } = require("../dist/dependency/capture/registry/registry.js");
const { DefaultCaptureQueryRegistry } = require("../dist/dependency/capture/query/registry.js");
const { PHP_PROFILE } = require("../dist/dependency/capture/profiles/php.js");

const WASM_PATH = path.resolve(__dirname, "fixtures/tree-sitter/tree-sitter-php.wasm");
const FIXTURES_DIR = path.resolve(__dirname, "fixtures/universal-capture/php-base");

async function setupOrchestrator() {
	const tsAdapter = await TreeSitterParserAdapter.create({
		php: WASM_PATH
	});

	const detector = new FileExtensionDetector();
	detector.registerProfile(PHP_PROFILE);

	const parserRegistry = new DefaultParserRegistry();
	parserRegistry.register(tsAdapter);

	const queryRegistry = new DefaultCaptureQueryRegistry();
	queryRegistry.register(PHP_CAPTURE_QUERY);

	return new UniversalCaptureOrchestrator(detector, parserRegistry, queryRegistry);
}

test("PHP Capture: Setup and dynamic/unregistered cases", async () => {
	const orchestrator = await setupOrchestrator();

	// Unknown extension returns null
	const result = orchestrator.capture("file.unknown");
	assert.equal(result, null);
});

test("PHP Capture: Simple use statement", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "simple-use.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.sourceLanguage, "php");
	assert.equal(result.edges.length, 1);

	const edge = result.edges[0];
	assert.equal(edge.specifier, "App\\Models\\User");
	assert.equal(edge.kind, "use");
	assert.equal(edge.syntaxKind, "use-statement");
	assert.equal(edge.isDynamic, false);
});

test("PHP Capture: Aliased use statement", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "aliased-use.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.edges.length, 1);

	const edge = result.edges[0];
	// Should capture FQCN, not alias U
	assert.equal(edge.specifier, "App\\Models\\User");
	assert.equal(edge.kind, "use");
});

test("PHP Capture: Grouped use statement", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "grouped-use.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.edges.length, 2);

	// Sorted by specifier name for comparison
	const edges = [...result.edges].sort((a, b) => a.specifier.localeCompare(b.specifier));
	
	assert.equal(edges[0].specifier, "App\\Models\\Team");
	assert.equal(edges[0].kind, "use");
	assert.equal(edges[0].syntaxKind, "grouped-use-statement");

	assert.equal(edges[1].specifier, "App\\Models\\User");
	assert.equal(edges[1].kind, "use");
	assert.equal(edges[1].syntaxKind, "grouped-use-statement");
});

test("PHP Capture: Multiple uses", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "multi-use.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.edges.length, 2);

	const specs = result.edges.map(e => e.specifier);
	assert.ok(specs.includes("App\\Models\\User"));
	assert.ok(specs.includes("App\\Models\\Team"));
});

test("PHP Capture: Namespace declaration and context", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "with-namespace.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.namespaceContext, "App\\Controllers");
	assert.equal(result.edges.length, 1);
	assert.equal(result.edges[0].specifier, "App\\Models\\User");
});

test("PHP Capture: Literal require path", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "require-literal.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.edges.length, 2);

	assert.equal(result.edges[0].specifier, "./helpers.php");
	assert.equal(result.edges[0].kind, "require");
	assert.equal(result.edges[0].syntaxKind, "require-literal");

	assert.equal(result.edges[1].specifier, "lib/boot.php");
	assert.equal(result.edges[1].kind, "require");
	assert.equal(result.edges[1].syntaxKind, "require-once-literal");
});

test("PHP Capture: Literal include path", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "include-literal.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.edges.length, 2);

	assert.equal(result.edges[0].specifier, "./config.php");
	assert.equal(result.edges[0].kind, "include");
	assert.equal(result.edges[0].syntaxKind, "include-literal");

	assert.equal(result.edges[1].specifier, "shared.php");
	assert.equal(result.edges[1].kind, "include");
	assert.equal(result.edges[1].syntaxKind, "include-once-literal");
});

test("PHP Capture: Fully-qualified new reference", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "fq-new.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.edges.length, 1);

	// Strip leading backslash
	assert.equal(result.edges[0].specifier, "App\\Services\\UserService");
	assert.equal(result.edges[0].kind, "reference");
	assert.equal(result.edges[0].syntaxKind, "fq-class-reference");
});

test("PHP Capture: Fully-qualified ::class reference", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "fq-static.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.edges.length, 1);

	assert.equal(result.edges[0].specifier, "App\\Services\\UserService");
	assert.equal(result.edges[0].kind, "reference");
	assert.equal(result.edges[0].syntaxKind, "fq-class-reference");
});

test("PHP Capture: Attribute class reference", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "attribute-ref.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.edges.length, 1);

	assert.equal(result.edges[0].specifier, "App\\Attributes\\AdminOnly");
	assert.equal(result.edges[0].kind, "reference");
	assert.equal(result.edges[0].syntaxKind, "fq-class-reference");
});

test("PHP Capture: Fully-qualified type hint", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "fq-typehint.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	// int type hint should be ignored, onlyRequest and Response are captured
	assert.equal(result.edges.length, 2);

	const specs = result.edges.map(e => e.specifier);
	assert.ok(specs.includes("App\\Http\\Request"));
	assert.ok(specs.includes("App\\Http\\Response"));
});

test("PHP Capture: Exclude use function", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "use-function.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.edges.length, 0);
});

test("PHP Capture: Exclude use const", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "use-const.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.edges.length, 0);
});

test("PHP Capture: Exclude dynamic require", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "dynamic-require.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.edges.length, 0);
});

test("PHP Capture: No dependencies", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "no-deps.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.edges.length, 0);
});

test("PHP Capture: Syntax error partial recovery", async () => {
	const orchestrator = await setupOrchestrator();
	const file = path.join(FIXTURES_DIR, "syntax-error.php");

	const result = orchestrator.capture(file);
	assert.ok(result);
	assert.equal(result.parseError, "Document contains syntax errors");
	// Should recover valid use statements surrounding syntax error
	assert.equal(result.edges.length, 2);

	const specs = result.edges.map(e => e.specifier);
	assert.ok(specs.includes("App\\Models\\User"));
	assert.ok(specs.includes("App\\Models\\Team"));
});
