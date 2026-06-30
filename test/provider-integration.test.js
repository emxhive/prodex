// @ts-nocheck
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { collectTraceSources } = require("../dist/tracing/collect-trace.js");
const { resetProviderBridge } = require("../dist/tracing/resolver-bridge.js");

const FIXTURES_DIR = path.resolve(__dirname, "fixtures/universal-resolution/php-base");

function getResolveFile(relPath) {
	return path.join(FIXTURES_DIR, relPath).replace(/\\/g, "/");
}

test("Provider Integration: Traces transitive PHP class dependencies cleanly", async () => {
	resetProviderBridge();

	const entryFile = getResolveFile("src/Controllers/OrderController.php");

	const result = await collectTraceSources({
		cfg: {
			root: FIXTURES_DIR,
			exclude: ["node_modules/**", "vendor/**"],
			depth: 5,
			maxFiles: 100,
			output: {
				dir: "dist",
				versioned: false,
				format: "txt"
			},
			entry: [entryFile],
			include: [],
			aliases: {},
			scopes: {}
		},
		opts: {
			entries: [entryFile]
		}
	});

	// Transitive graph: OrderController.php -> OrderService.php -> User.php
	assert.ok(result.files.includes(getResolveFile("src/Controllers/OrderController.php")));
	assert.ok(result.files.includes(getResolveFile("src/Services/OrderService.php")));
	assert.ok(result.files.includes(getResolveFile("src/Models/User.php")));

	// Verify stats mapping
	const expected = Array.from(result.stats.expected);
	const resolved = Array.from(result.stats.resolved);

	assert.ok(expected.includes(getResolveFile("src/Services/OrderService.php")));
	assert.ok(expected.includes(getResolveFile("src/Models/User.php")));
	assert.ok(resolved.includes(getResolveFile("src/Services/OrderService.php")));
	assert.ok(resolved.includes(getResolveFile("src/Models/User.php")));
});

test("Provider Integration: Traces mixed JS and PHP files cleanly in polyglot fixture", async () => {
	resetProviderBridge();

	// We use the polyglot-basic fixture which has AlertService.php and main.ts
	const polyglotDir = path.resolve(__dirname, "fixtures/universal-resolution/polyglot-basic");
	const entryFile = path.join(polyglotDir, "src/main.ts").replace(/\\/g, "/");

	const result = await collectTraceSources({
		cfg: {
			root: polyglotDir,
			exclude: ["node_modules/**"],
			depth: 5,
			maxFiles: 100,
			output: {
				dir: "dist",
				versioned: false,
				format: "txt"
			},
			entry: [entryFile],
			include: [],
			aliases: {},
			scopes: {}
		},
		opts: {
			entries: [entryFile]
		}
	});

	// main.ts is TS so it resolves using legacy resolver (still works)
	assert.ok(result.files.includes(entryFile));
});
