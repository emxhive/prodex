// @ts-nocheck
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
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
	assert.equal(result.ownership.kind, "local");
	assert.equal(result.ownership.reason, "project-owned");
	assert.equal(result.ownership.ecosystem, "php");
	assert.equal(result.ownership.specifier, "App\\Models\\User");
	assert.equal(result.ownership.specifierRoot, "App\\");
	assert.equal(result.ownership.sourceFile, getFixtureFile("src/Services/OrderService.php"));
	assert.equal(result.ownership.evidence.composerPath, getFixtureFile("composer.json"));
	assert.equal(result.ownership.evidence.matchedPrefix, "App\\");
	assert.deepEqual(result.ownership.evidence.mappedDirs, [getFixtureFile("src")]);
	assert.equal(result.ownership.evidence.resolvedFile, getFixtureFile("src/Models/User.php"));
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
	assert.equal(result.ownership.kind, "local");
	assert.equal(result.ownership.reason, "project-owned");
	assert.equal(result.ownership.ecosystem, "php");
	assert.equal(result.ownership.specifierRoot, "App\\");
	assert.equal(result.ownership.evidence.composerPath, getFixtureFile("composer.json"));
	assert.equal(result.ownership.evidence.matchedPrefix, "App\\");
	assert.deepEqual(result.ownership.evidence.mappedDirs, [getFixtureFile("src")]);
	assert.equal(result.ownership.evidence.resolvedFile, undefined);
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
	assert.notEqual(result.ownership?.reason, "undeclared");
});

test("PHP Resolution: PSR-4 mapping to vendor is not project-owned", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-php-psr4-vendor-"));
	try {
		fs.mkdirSync(path.join(root, "src"), { recursive: true });
		fs.mkdirSync(path.join(root, "vendor/vendorish/src"), { recursive: true });
		fs.writeFileSync(path.join(root, "composer.json"), JSON.stringify({
			autoload: {
				"psr-4": {
					"Vendorish\\": "vendor/vendorish/src/"
				}
			}
		}, null, 2));
		fs.writeFileSync(path.join(root, "vendor/vendorish/src/Foo.php"), "<?php namespace Vendorish; class Foo {}\n");
		const sourceFile = path.join(root, "src/Caller.php").replace(/\\/g, "/");
		fs.writeFileSync(sourceFile, "<?php use Vendorish\\Foo;\n");

		const index = await indexWorkspace(root);
		const resolver = new UniversalResolver(index);
		const requests = edgesToRequests([{
			specifier: "Vendorish\\Foo",
			kind: "use",
			sourceFile,
			sourceLanguage: "php",
			syntaxKind: "use-statement"
		}], { profile: PHP_PROFILE });
		const result = resolver.resolve(requests[0]);

		assert.notEqual(result.ownership?.kind, "local");
		assert.notEqual(result.ownership?.reason, "project-owned");
		assert.equal(result.ownership?.reason, "policy-denied");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("PHP Resolution: PSR-4 mapping outside root is not project-owned", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-php-psr4-outside-"));
	const outside = path.join(path.dirname(root), `${path.basename(root)}-shared`);
	try {
		fs.mkdirSync(path.join(root, "src"), { recursive: true });
		fs.mkdirSync(outside, { recursive: true });
		fs.writeFileSync(path.join(root, "composer.json"), JSON.stringify({
			autoload: {
				"psr-4": {
					"Shared\\": "../shared/"
				}
			}
		}, null, 2));
		fs.writeFileSync(path.join(outside, "Thing.php"), "<?php namespace Shared; class Thing {}\n");
		const sourceFile = path.join(root, "src/Caller.php").replace(/\\/g, "/");
		fs.writeFileSync(sourceFile, "<?php use Shared\\Thing;\n");

		const index = await indexWorkspace(root);
		const resolver = new UniversalResolver(index);
		const requests = edgesToRequests([{
			specifier: "Shared\\Thing",
			kind: "use",
			sourceFile,
			sourceLanguage: "php",
			syntaxKind: "use-statement"
		}], { profile: PHP_PROFILE });
		const result = resolver.resolve(requests[0]);

		assert.notEqual(result.ownership?.kind, "local");
		assert.notEqual(result.ownership?.reason, "project-owned");
		assert.equal(result.level, "LX");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
		fs.rmSync(outside, { recursive: true, force: true });
	}
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
