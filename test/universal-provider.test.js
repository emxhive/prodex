// @ts-nocheck
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { UniversalDependencyProvider } = require("../dist/dependency/provider/universal-provider.js");

const JS_WASM = path.resolve(__dirname, "../assets/tree-sitter/tree-sitter-javascript.wasm");
const PHP_WASM = path.resolve(__dirname, "../assets/tree-sitter/tree-sitter-php.wasm");

const CAPTURE_DIR = path.resolve(__dirname, "fixtures/universal-capture/php-base");
const RESOLVE_DIR = path.resolve(__dirname, "fixtures/universal-resolution/php-base");

function getResolveFile(relPath) {
	return path.join(RESOLVE_DIR, relPath).replace(/\\/g, "/");
}

async function setupProvider() {
	return UniversalDependencyProvider.create({
		wasmPaths: {
			javascript: JS_WASM,
			php: PHP_WASM
		}
	});
}

test("Universal Provider: Unsupported file type returns diagnostics", async () => {
	const provider = await setupProvider();

	const res = await provider.resolve({
		root: RESOLVE_DIR,
		filePath: getResolveFile("src/Models/User.py") // Unsupported extension .py
	});

	assert.equal(res.files.length, 0);
	assert.equal(res.external.length, 0);
	assert.equal(res.unresolved.length, 0);
	assert.equal(res.diagnostics.length, 1);
	assert.equal(res.diagnostics[0].kind, "unsupported-profile");
	assert.ok(res.diagnostics[0].message.includes(".py"));
});

test("Universal Provider: Workspace index caching works correctly", async () => {
	const provider = await setupProvider();

	// Initially cache is empty
	assert.equal(provider["indexCache"].size, 0);

	await provider.resolve({
		root: RESOLVE_DIR,
		filePath: getResolveFile("src/Services/OrderService.php"),
		exclude: ["vendor/**", "node_modules/**"]
	});

	// Cache should now have 1 item
	assert.equal(provider["indexCache"].size, 1);

	// Running resolution again with same root and exclude list should hit cache
	await provider.resolve({
		root: RESOLVE_DIR,
		filePath: getResolveFile("src/Services/OrderService.php"),
		exclude: ["vendor/**", "node_modules/**"]
	});

	assert.equal(provider["indexCache"].size, 1);

	// Running with different exclude list should add another index to cache
	await provider.resolve({
		root: RESOLVE_DIR,
		filePath: getResolveFile("src/Services/OrderService.php"),
		exclude: ["vendor/**"]
	});

	assert.equal(provider["indexCache"].size, 2);

	// Clear cache
	provider.clearCache();
	assert.equal(provider["indexCache"].size, 0);
});

test("Universal Provider: PHP namespace PSR-4 mapping & stats mapping rules", async () => {
	const provider = await setupProvider();

	const res = await provider.resolve({
		root: RESOLVE_DIR,
		filePath: getResolveFile("src/Services/OrderService.php")
	});

	// OrderService.php imports App\Models\User;
	assert.equal(res.files.length, 1);
	assert.equal(res.files[0], getResolveFile("src/Models/User.php"));
	assert.equal(res.external.length, 0);
	assert.equal(res.unresolved.length, 0);
});

test("Universal Provider: PHP require/include literals and external/vendor namespaces mapping", async () => {
	const provider = await setupProvider();

	// We'll write a temporary file containing require literals, external, matched-but-missing namespace, and vendor namespaces
	const tempFile = getResolveFile("temp-provider-test.php");
	const fs = require("node:fs");
	fs.writeFileSync(tempFile, `<?php
require './helpers.php';
require 'bootstrap/app.php';
use App\\Models\\MissingClass; // matched namespace, missing file
use Symfony\\Component\\Console; // unmatched vendor namespace (ignored)
use lodash; // ignored
`);

	try {
		const res = await provider.resolve({
			root: RESOLVE_DIR,
			filePath: tempFile
		});

		// 1. Files resolved: helpers.php and bootstrap/app.php
		assert.equal(res.files.length, 2);
		assert.ok(res.files.includes(getResolveFile("helpers.php")));
		assert.ok(res.files.includes(getResolveFile("bootstrap/app.php")));

		// 2. External resolved: lodash
		// Note: since lodash is classified as external / bare in JS, but in PHP it falls to unmatched PSR-4 vendor,
		// let's check how it resolves. Symfony\Component\Console has no prefix, so it is ignored.
		// App\Models\MissingClass is matched but missing -> unresolved
		assert.equal(res.unresolved.length, 1);
		assert.equal(res.unresolved[0].specifier, "App\\Models\\MissingClass");
		assert.ok(res.ownership.some(o =>
			o.kind === "local" &&
			o.reason === "project-owned" &&
			o.ecosystem === "php" &&
			o.specifier === "App\\Models\\MissingClass"
		));
		assert.ok(!res.diagnostics.some(d => d.kind === "ownership-undeclared"));

		// Symfony and lodash (PHP unmatched vendor) should be ignored
		assert.ok(!res.unresolved.some(u => u.specifier.includes("Symfony")));
		assert.ok(!res.unresolved.some(u => u.specifier.includes("lodash")));
	} finally {
		if (fs.existsSync(tempFile)) {
			fs.unlinkSync(tempFile);
		}
	}
});
