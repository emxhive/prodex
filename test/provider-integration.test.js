// @ts-nocheck
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
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

test("Provider Integration: Traces TypeScript-family dependencies through universal provider", async () => {
	resetProviderBridge();

	const tsDir = path.resolve(__dirname, "fixtures/universal-resolution/typescript-basic");
	const entryFile = path.join(tsDir, "src/main.ts").replace(/\\/g, "/");

	const result = await collectTraceSources({
		cfg: {
			root: tsDir,
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

	const relFiles = result.files.map(f => path.relative(tsDir, f).replace(/\\/g, "/")).sort();

	assert.ok(relFiles.includes("src/main.ts"));
	assert.ok(relFiles.includes("src/helper.ts"));
	assert.ok(relFiles.includes("src/component.ts"));
	assert.ok(relFiles.includes("src/dep.ts"));
	assert.ok(relFiles.includes("src/nav-component.tsx"));
});

test("Provider Integration: Traces dependencies through tsconfig paths and prodex.json aliases", async () => {
	resetProviderBridge();

	const prDir = path.resolve(__dirname, "fixtures/universal-resolution/profile-rewrites");
	const entryFile = path.join(prDir, "src/main.ts").replace(/\\/g, "/");

	const result = await collectTraceSources({
		cfg: {
			root: prDir,
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
			aliases: {
				"@non-tsconfig-alias/*": "src/*"
			},
			scopes: {}
		},
		opts: {
			entries: [entryFile]
		}
	});

	const relFiles = result.files.map(f => path.relative(prDir, f).replace(/\\/g, "/")).sort();

	// Verify both TSConfig path and prodex.json alias resolved successfully
	assert.ok(relFiles.includes("src/main.ts"));
	assert.ok(relFiles.includes("src/helper.ts"));
	assert.ok(relFiles.includes("src/other-helper.ts"));
});

test("Provider Integration: Preserves suspicious ownership diagnostics through bridge", async () => {
	resetProviderBridge();

	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-provider-ownership-"));
	try {
		fs.mkdirSync(path.join(root, "src"), { recursive: true });
		fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "app" }, null, 2));
		const entryFile = path.join(root, "src/main.ts").replace(/\\/g, "/");
		fs.writeFileSync(entryFile, "import missing from 'not-declared';\nexport const main = true;\n");

		const result = await collectTraceSources({
			cfg: {
				root,
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

		assert.ok(result.files.includes(entryFile));
		assert.ok(result.diagnostics.some(diagnostic =>
			diagnostic.ownership?.reason === "undeclared" &&
			diagnostic.ownership?.specifierRoot === "not-declared"
		));
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

