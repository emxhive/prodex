// @ts-nocheck
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
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
	assert.ok(res.ownership.some(o =>
		o.kind === "local" &&
		o.reason === "project-owned" &&
		o.ecosystem === "php" &&
		o.specifier === "App\\Models\\User"
	));
	assert.equal(res.diagnostics.some(d => d.kind === "ownership-project-owned-unresolved"), false);
});

test("Universal Provider: PHP require/include literals and external/vendor namespaces mapping", async () => {
	const provider = await setupProvider();

	// We'll write a temporary file containing require literals, external, matched-but-missing namespace, and vendor namespaces
	const tempFile = getResolveFile("temp-provider-test.php");
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

		// 1. Files resolved: none (relative/search paths are unresolved)
		assert.equal(res.files.length, 0);

		// 2. Unresolved: MissingClass, helpers.php, bootstrap/app.php
		assert.equal(res.unresolved.length, 3);
		const unresolvedSpecs = res.unresolved.map(u => u.specifier);
		assert.ok(unresolvedSpecs.includes("App\\Models\\MissingClass"));
		assert.ok(unresolvedSpecs.includes("./helpers.php"));
		assert.ok(unresolvedSpecs.includes("bootstrap/app.php"));
		assert.ok(res.ownership.some(o =>
			o.kind === "local" &&
			o.reason === "project-owned" &&
			o.ecosystem === "php" &&
			o.specifier === "App\\Models\\MissingClass"
		));
		assert.ok(res.diagnostics.some(d =>
			d.kind === "ownership-project-owned-unresolved" &&
			d.ownership?.specifier === "App\\Models\\MissingClass"
		));
		assert.ok(!res.diagnostics.some(d => d.kind === "ownership-undeclared"));

		// Symfony and lodash (PHP unmatched vendor) should be ignored
		assert.ok(!res.unresolved.some(u => u.specifier.includes("Symfony")));
		assert.ok(!res.unresolved.some(u => u.specifier.includes("lodash")));
		assert.ok(!res.diagnostics.some(d => d.message.includes("Symfony") || d.message.includes("lodash")));
	} finally {
		if (fs.existsSync(tempFile)) {
			fs.unlinkSync(tempFile);
		}
	}
});

test("Universal Provider: Laravel-shaped route imports local controller and keeps framework namespace quiet", async () => {
	const provider = await setupProvider();
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-laravel-shaped-"));

	try {
		fs.mkdirSync(path.join(root, "routes"), { recursive: true });
		fs.mkdirSync(path.join(root, "app/Http/Controllers"), { recursive: true });
		fs.writeFileSync(path.join(root, "composer.json"), JSON.stringify({
			require: {
				"laravel/framework": "^11.0"
			},
			autoload: {
				"psr-4": {
					"App\\": "app/"
				}
			}
		}, null, 2));
		fs.writeFileSync(path.join(root, "app/Http/Controllers/HomeController.php"), `<?php
namespace App\\Http\\Controllers;
class HomeController {}
`);
		const routeFile = path.join(root, "routes/web.php").replace(/\\/g, "/");
		fs.writeFileSync(routeFile, `<?php
use App\\Http\\Controllers\\HomeController;
use Illuminate\\Support\\Facades\\Route;
`);

		const res = await provider.resolve({
			root,
			filePath: routeFile,
			exclude: ["vendor/**"]
		});

		const controllerPath = path.join(root, "app/Http/Controllers/HomeController.php").replace(/\\/g, "/");
		assert.deepEqual(res.files, [controllerPath]);
		assert.ok(res.ownership.some(o =>
			o.kind === "local" &&
			o.reason === "project-owned" &&
			o.ecosystem === "php" &&
			o.specifier === "App\\Http\\Controllers\\HomeController"
		));
		assert.equal(res.unresolved.some(u => u.specifier.includes("Illuminate")), false);
		assert.equal(res.diagnostics.some(d => d.message.includes("Illuminate")), false);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});
