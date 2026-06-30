const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { globScan } = require("../dist/filesystem/glob-scan.js");
const { DEFAULT_PRODEX_CONFIG } = require("../dist/config/default-config.js");

const { loadConfig, validateConfig } = require("../dist/config/load.js");
const { migrateConfig } = require("../dist/config/migration/transform.js");

async function usingTempProjectAsync(fn) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-test-"));
	try {
		return await fn(root);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

function writeFile(filePath, value) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, value, "utf8");
}

function writeJson(filePath, value) {
	writeFile(filePath, JSON.stringify(value, null, 2));
}

test("globScan does not hard-ignore paths like node_modules, vendor, dist", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "node_modules/foo.ts"), "export const foo = 1;");
		writeFile(path.join(root, "dist/bar.ts"), "export const bar = 1;");
		writeFile(path.join(root, "src/index.ts"), "export const index = 1;");

		// globScan without ignores will scan node_modules and dist now
		const { files } = await globScan(["**/*.ts"], { cwd: root });
		const relativeFiles = files.map(f => path.relative(root, f).replaceAll("\\", "/")).sort();

		assert.ok(relativeFiles.includes("node_modules/foo.ts"));
		assert.ok(relativeFiles.includes("dist/bar.ts"));
		assert.ok(relativeFiles.includes("src/index.ts"));
	});
});

test("DEFAULT_PRODEX_CONFIG no longer excludes shadcn components or UI", () => {
	const excludes = DEFAULT_PRODEX_CONFIG.exclude || [];
	assert.ok(!excludes.includes("@shadcn/**"));
	assert.ok(!excludes.includes("**/components/ui/**"));
	// Broader noise exclusions remain
	assert.ok(excludes.includes("node_modules/**"));
	assert.ok(excludes.includes("vendor/**"));
	assert.ok(excludes.includes("dist/**"));
});



test("loadConfig deep clones defaults and rejects future versions", async () => {
	await usingTempProjectAsync(async (root) => {
		// 1. Future config version
		writeJson(path.join(root, "prodex.json"), {
			version: 6,
			$schema: "schema"
		});

		const resFuture = loadConfig(root);
		assert.equal(resFuture.errors.length, 1);
		assert.match(resFuture.errors[0], /future config version 6/);

		// 2. Deep clone check: mutating returned default should not affect subsequent loads
		fs.rmSync(path.join(root, "prodex.json"));
		const resDefault1 = loadConfig(root);
		resDefault1.config.depth = 999;

		const resDefault2 = loadConfig(root);
		assert.notEqual(resDefault2.config.depth, 999);
	});
});

test("validateConfig shape validation checks", () => {
	// Valid v5
	const valid = {
		version: 5,
		$schema: "schema",
		output: {
			dir: "prodex",
			versioned: true,
			format: "md"
		},
		exclude: ["node_modules/**"],
		aliases: { "@": "src" },
		depth: 3,
		scopes: {
			dashboard: {
				name: "dash",
				entry: ["src/index.ts"]
			}
		}
	};
	assert.equal(validateConfig(valid).length, 0);

	// Invalid version
	assert.ok(validateConfig({ version: 4 }).length > 0);

	// Unknown root keys
	assert.ok(validateConfig({ version: 5, unknownKey: "oops" }).length > 0);

	// Invalid output format
	assert.ok(validateConfig({ version: 5, output: { format: "pdf" } }).length > 0);

	// Invalid scope keys
	assert.ok(validateConfig({
		version: 5,
		scopes: {
			dashboard: {
				invalidKey: "wat"
			}
		}
	}).length > 0);
});

test("migrateConfig output sanitization prevents leakage", () => {
	const legacyInput = {
		version: 3,
		output: {
			dir: "out",
			format: "txt",
			unknownField: "leak"
		}
	};

	const migration = migrateConfig(legacyInput);
	assert.equal(migration.config.output.unknownField, undefined);
	assert.equal(migration.config.output.dir, "out");
	assert.equal(migration.config.output.format, "txt");
});
