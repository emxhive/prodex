const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const binPath = path.join(repoRoot, "bin", "prodex.js");
const { runProdexCommand } = require("../dist/index.js");
const { reportCommandResult } = require("../dist/cli/reporter.js");

test("global help and version are side-effect free command results", async () => {
	const help = await runProdexCommand(["node", "prodex", "run", "--help"], repoRoot);
	assert.equal(help.ok, true);
	assert.equal(help.exitCode, 0);
	assert.match(help.message, /prodex run/);
	assert.equal(help.runs.length, 0);

	const version = await runProdexCommand(["node", "prodex", "--version"], repoRoot);
	assert.equal(version.ok, true);
	assert.equal(version.exitCode, 0);
	assert.match(version.message, /^prodex v/);
	assert.equal(version.runs.length, 0);
});

test("commands are mandatory", async () => {
	const result = await runProdexCommand(["node", "prodex", "--entry", "src/index.ts"], repoRoot);
	assert.equal(result.ok, false);
	assert.equal(result.exitCode, 1);
	assert.match(result.errors.join("\n"), /Unknown command "--entry"/);
	assert.equal(result.runs.length, 0);
});

test("unknown flags and invalid roots fail without producing runs", async () => {
	const badFlag = await runProdexCommand(["node", "prodex", "run", "--wat"], repoRoot);
	assert.equal(badFlag.ok, false);
	assert.equal(badFlag.exitCode, 1);
	assert.deepEqual(badFlag.errors, ['Unknown flag "--wat".']);
	assert.equal(badFlag.runs.length, 0);

	const badRoot = await runProdexCommand(["node", "prodex", "run", "missing-folder"], repoRoot);
	assert.equal(badRoot.ok, false);
	assert.equal(badRoot.exitCode, 1);
	assert.match(badRoot.errors.join("\n"), /Invalid root path/);
	assert.equal(badRoot.runs.length, 0);
});

test("unknown profiles fail loudly and do not fall back to defaults", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig({ entry: ["src/index.ts"] }));
		writeFile(path.join(root, "src", "index.ts"), "export const value = 1;\n");

		const result = await runProdexCommand(["node", "prodex", "run", "--profile", "missing"], root);
		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.match(result.errors.join("\n"), /Unknown profile "missing"/);
		assert.equal(result.runs.length, 0);
		assertOutputDirEmpty(root);
	});
});

test("all-profiles fails when no profiles are configured", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());

		const result = await runProdexCommand(["node", "prodex", "run", "--all-profiles"], root);
		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.match(result.errors.join("\n"), /No profiles are defined/);
		assert.equal(result.runs.length, 0);
	});
});

test("profiles command lists configured profile keys without running", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(
			path.join(root, "prodex.json"),
			baseConfig({
				profiles: {
					dashboard: { entry: ["src/dashboard.ts"] },
					api: { entry: ["src/api.ts"] },
				},
			}),
		);

		const result = await runProdexCommand(["node", "prodex", "profiles"], root);
		assert.equal(result.ok, true);
		assert.equal(result.exitCode, 0);
		assert.deepEqual(result.profiles, ["api", "dashboard"]);
		assert.equal(result.runs.length, 0);
		assertOutputDirEmpty(root);
	});
});

test("profiles command reports empty configs cleanly", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());

		const result = await runProdexCommand(["node", "prodex", "profiles"], root);
		assert.equal(result.ok, true);
		assert.deepEqual(result.profiles, []);

		const output = captureStdout(() => reportCommandResult(result));
		assert.match(output, /No profiles configured\./);
	});
});

test("profiles command validates root paths", async () => {
	const result = await runProdexCommand(["node", "prodex", "profiles", "missing-folder"], repoRoot);
	assert.equal(result.ok, false);
	assert.equal(result.exitCode, 1);
	assert.match(result.errors.join("\n"), /Invalid root path/);
	assert.equal(result.runs.length, 0);
});

test("runs with no entries and no includes fail plainly", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());

		const result = await runProdexCommand(["node", "prodex", "run"], root);
		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.match(result.runs[0].errors.join("\n"), /No entry files found/);
		assert.equal(result.runs[0].mode, "include-only");
		assert.equal(result.runs[0].files.length, 0);
		assertOutputDirEmpty(root);
	});
});

test("multiple profiles run in the order the user provided", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(
			path.join(root, "prodex.json"),
			baseConfig({
				profiles: {
					first: { name: "first", entry: ["src/first.ts"] },
					second: { name: "second", entry: ["src/second.ts"] },
				},
			}),
		);
		writeFile(path.join(root, "src", "first.ts"), "export const first = true;\n");
		writeFile(path.join(root, "src", "second.ts"), "export const second = true;\n");

		const result = await runProdexCommand(["node", "prodex", "run", "--profile", "second", "--profile", "first", "--format", "txt"], root);
		assert.equal(result.ok, true);
		assert.deepEqual(result.runs.map((run) => run.profile), ["second", "first"]);
		assert.match(path.basename(result.runs[0].outputPath), /^second-trace_/);
		assert.match(path.basename(result.runs[1].outputPath), /^first-trace_/);
	});
});

test("trace mode resolves entry dependencies and reports trace mode", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src", "index.ts"), 'import "./dep";\nexport const entry = true;\n');
		writeFile(path.join(root, "src", "dep.ts"), "export const dep = true;\n");

		const result = await runProdexCommand(
			["node", "prodex", "run", "--entry", "src/index.ts", "--name", "trace", "--format", "txt"],
			root,
		);

		assert.equal(result.ok, true);
		assert.equal(result.exitCode, 0);
		assert.equal(result.runs.length, 1);
		assert.equal(result.runs[0].mode, "trace");
		assert.equal(result.runs[0].entries.length, 1);
		assert.equal(result.runs[0].includes.length, 0);
		assert.equal(result.runs[0].files.length, 2);
		assertFileExists(result.runs[0].outputPath);
	});
});

test("include-only mode does not pretend entries were missing", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "notes", "context.md"), "# Context\n");

		const result = await runProdexCommand(
			["node", "prodex", "run", "--include", "notes/context.md", "--name", "includes", "--format", "txt"],
			root,
		);

		assert.equal(result.ok, true);
		assert.equal(result.runs.length, 1);
		assert.equal(result.runs[0].mode, "include-only");
		assert.equal(result.runs[0].entries.length, 0);
		assert.deepEqual(result.runs[0].includes, ["notes/context.md"]);
		assert.equal(result.runs[0].files.length, 1);
		assertFileExists(result.runs[0].outputPath);
	});
});

test("mixed mode reports entries and include patterns separately", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src", "index.ts"), "export const entry = true;\n");
		writeFile(path.join(root, "notes", "context.md"), "# Context\n");

		const result = await runProdexCommand(
			["node", "prodex", "run", "--entry", "src/index.ts", "--include", "notes/context.md", "--name", "mixed", "--format", "txt"],
			root,
		);

		assert.equal(result.ok, true);
		assert.equal(result.runs[0].mode, "mixed");
		assert.equal(result.runs[0].entries.length, 1);
		assert.deepEqual(result.runs[0].includes, ["notes/context.md"]);
		assert.equal(result.runs[0].files.length, 2);
	});
});

test("reporter prints relative output paths and mode-specific counts", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "notes", "context.md"), "# Context\n");

		const result = await runProdexCommand(
			["node", "prodex", "run", "--include", "notes/context.md", "--name", "includes", "--format", "txt"],
			root,
		);

		const output = captureStdout(() => reportCommandResult(result));
		assert.match(output, /Created: prodex\/includes-trace_/);
		assert.match(output, /Mode: include-only \(1 include patterns\)/);
		assert.match(output, /Files: 1 total/);
		assert.doesNotMatch(output, escapedForRegExp(root));
	});
});

test("bin output uses the same concise reporting contract", () => {
	usingTempProject((root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "notes", "context.md"), "# Context\n");

		const child = spawnSync(process.execPath, [binPath, "run", "--include", "notes/context.md", "--name", "bin-includes", "--format", "txt"], {
			cwd: root,
			encoding: "utf8",
		});

		assert.equal(child.status, 0, child.stderr);
		assert.match(child.stdout, /Created: prodex\/bin-includes-trace_/);
		assert.match(child.stdout, /Mode: include-only \(1 include patterns\)/);
		assert.match(child.stdout, /Files: 1 total/);
		assert.doesNotMatch(child.stdout, escapedForRegExp(root));
		assert.equal(child.stderr, "");
	});
});

test("bin prints available profiles", () => {
	usingTempProject((root) => {
		writeJson(
			path.join(root, "prodex.json"),
			baseConfig({
				profiles: {
					api: { entry: ["routes/api.php"] },
					dashboard: { entry: ["src/dashboard.ts"] },
				},
			}),
		);

		const child = spawnSync(process.execPath, [binPath, "profiles"], {
			cwd: root,
			encoding: "utf8",
		});

		assert.equal(child.status, 0, child.stderr);
		assert.match(child.stdout, /Available profiles:/);
		assert.match(child.stdout, /  api/);
		assert.match(child.stdout, /  dashboard/);
		assert.equal(child.stderr, "");
		assertOutputDirEmpty(root);
	});
});

test("init creates a config and refuses accidental overwrite", async () => {
	await usingTempProjectAsync(async (root) => {
		const first = await runProdexCommand(["node", "prodex", "init"], root);
		assert.equal(first.ok, true);
		assertFileExists(path.join(root, "prodex.json"));

		const second = await runProdexCommand(["node", "prodex", "init"], root);
		assert.equal(second.ok, false);
		assert.equal(second.exitCode, 1);
		assert.match(second.errors.join("\n"), /already exists/);
	});
});

function baseConfig(overrides = {}) {
	return {
		version: 4,
		$schema: "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
		output: { dir: "prodex", versioned: true, format: "md" },
		entry: [],
		include: [],
		exclude: ["node_modules/**"],
		resolve: { aliases: {}, maxDepth: 10, maxFiles: 200 },
		profiles: {},
		...overrides,
	};
}

function usingTempProject(fn) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-test-"));
	try {
		return fn(root);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

async function usingTempProjectAsync(fn) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-test-"));
	try {
		return await fn(root);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

function writeJson(filePath, value) {
	writeFile(filePath, JSON.stringify(value, null, 2));
}

function writeFile(filePath, value) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, value, "utf8");
}

function assertFileExists(filePath) {
	assert.ok(filePath, "expected an output path");
	assert.equal(fs.existsSync(filePath), true, `expected ${filePath} to exist`);
}

function assertOutputDirEmpty(root) {
	const outDir = path.join(root, "prodex");
	if (!fs.existsSync(outDir)) return;
	assert.deepEqual(fs.readdirSync(outDir), []);
}

function captureStdout(fn) {
	const original = console.log;
	let output = "";
	console.log = (...args) => {
		output += `${args.join(" ")}\n`;
	};
	try {
		fn();
		return output;
	} finally {
		console.log = original;
	}
}

function escapedForRegExp(value) {
	return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}
