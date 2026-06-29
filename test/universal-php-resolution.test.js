// @ts-nocheck
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { indexWorkspace } = require("../dist/dependency/workspace/index.js");
const { UniversalResolver } = require("../dist/dependency/resolve/resolver.js");
const { PHP_PROFILE } = require("../dist/dependency/capture/profiles/php.js");
const { edgesToRequests } = require("../dist/dependency/capture/bridge.js");

const FIXTURES_DIR = path.resolve(__dirname, "fixtures/universal-resolution/php-base");

function getFixtureFile(relPath) {
	return path.join(FIXTURES_DIR, relPath).replace(/\\/g, "/");
}

async function setupResolver() {
	const index = await indexWorkspace(FIXTURES_DIR);
	return new UniversalResolver(index);
}

test("PHP Resolution: Namespace class resolves correctly via PSR-4", async () => {
	const resolver = await setupResolver();

	const edges = [
		{
			specifier: "App\\Models\\User",
			kind: "use",
			sourceFile: getFixtureFile("src/Services/OrderService.php"),
			sourceLanguage: "php",
			syntaxKind: "use-statement"
		}
	];

	const requests = edgesToRequests(edges, { profile: PHP_PROFILE });
	const result = resolver.resolve(requests[0]);

	assert.equal(result.status, "resolved");
	assert.equal(result.level, "L10");
	assert.equal(result.strategy, "php-namespace");
	assert.equal(result.file, getFixtureFile("src/Models/User.php"));
});

test("PHP Resolution: Grouped namespace resolves correctly", async () => {
	const resolver = await setupResolver();

	const edges = [
		{
			specifier: "App\\Models\\Team",
			kind: "use",
			sourceFile: getFixtureFile("src/Services/OrderService.php"),
			sourceLanguage: "php",
			syntaxKind: "grouped-use-statement"
		}
	];

	const requests = edgesToRequests(edges, { profile: PHP_PROFILE });
	const result = resolver.resolve(requests[0]);

	assert.equal(result.status, "resolved");
	assert.equal(result.level, "L10");
	assert.equal(result.file, getFixtureFile("src/Models/Team.php"));
});

test("PHP Resolution: FQ class reference resolves correctly", async () => {
	const resolver = await setupResolver();

	const edges = [
		{
			specifier: "App\\Http\\Request",
			kind: "reference",
			sourceFile: getFixtureFile("src/Controllers/OrderController.php"),
			sourceLanguage: "php",
			syntaxKind: "fq-class-reference"
		}
	];

	const requests = edgesToRequests(edges, { profile: PHP_PROFILE });
	const result = resolver.resolve(requests[0]);

	assert.equal(result.status, "resolved");
	assert.equal(result.level, "L10");
	assert.equal(result.file, getFixtureFile("src/Http/Request.php"));
});

test("PHP Resolution: Namespace matches PSR-4 but file not found is unresolved", async () => {
	const resolver = await setupResolver();

	const edges = [
		{
			specifier: "App\\Models\\Missing",
			kind: "use",
			sourceFile: getFixtureFile("src/Services/OrderService.php"),
			sourceLanguage: "php",
			syntaxKind: "use-statement"
		}
	];

	const requests = edgesToRequests(edges, { profile: PHP_PROFILE });
	const result = resolver.resolve(requests[0]);

	assert.equal(result.status, "unresolved");
	assert.equal(result.level, "L10");
	assert.equal(result.strategy, "php-namespace");
	assert.ok(result.reason.includes("file not found"));
});

test("PHP Resolution: Vendor namespace with no PSR-4 prefix falls to LX unresolved", async () => {
	const resolver = await setupResolver();

	const edges = [
		{
			specifier: "Vendor\\SomeLib\\Foo",
			kind: "use",
			sourceFile: getFixtureFile("src/Services/OrderService.php"),
			sourceLanguage: "php",
			syntaxKind: "use-statement"
		}
	];

	const requests = edgesToRequests(edges, { profile: PHP_PROFILE });
	const result = resolver.resolve(requests[0]);

	assert.equal(result.status, "unresolved");
	assert.equal(result.level, "LX");
	assert.equal(result.strategy, "unresolved-fallback");
});

test("PHP Resolution: Literal relative paths resolve correctly via L3", async () => {
	const resolver = await setupResolver();

	const edges = [
		{
			specifier: "./helpers.php",
			kind: "require",
			sourceFile: getFixtureFile("index.php"),
			sourceLanguage: "php",
			syntaxKind: "require-literal"
		}
	];

	const requests = edgesToRequests(edges, { profile: PHP_PROFILE });
	const result = resolver.resolve(requests[0]);

	assert.equal(result.status, "resolved");
	assert.equal(result.level, "L3");
	assert.equal(result.file, getFixtureFile("helpers.php"));
});

test("PHP Resolution: Non-relative require literal path resolves relative via classification normalization", async () => {
	const resolver = await setupResolver();

	const edges = [
		{
			specifier: "bootstrap/app.php",
			kind: "require",
			sourceFile: getFixtureFile("helpers.php"), // origin is root directory
			sourceLanguage: "php",
			syntaxKind: "require-once-literal"
		}
	];

	const requests = edgesToRequests(edges, { profile: PHP_PROFILE });
	const result = resolver.resolve(requests[0]);

	assert.equal(result.status, "resolved");
	assert.equal(result.level, "L3");
	assert.equal(result.file, getFixtureFile("bootstrap/app.php"));
});

test("PHP Resolution: Non-PHP requests are not routed to PHP namespace strategy", async () => {
	const resolver = await setupResolver();

	const edges = [
		{
			specifier: "App\\Models\\User",
			kind: "import",
			sourceFile: getFixtureFile("src/Services/OrderService.php"),
			sourceLanguage: "javascript",
			syntaxKind: "esm-import"
		}
	];

	// No profile or javascript profile
	const requests = edgesToRequests(edges);
	const result = resolver.resolve(requests[0]);

	// Should not match L10 since language is javascript and classification is bare (falls to LX or L7)
	assert.notEqual(result.level, "L10");
});
