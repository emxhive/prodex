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
	const globalHelp = await runProdexCommand(["node", "prodex", "--help"], repoRoot);
	assert.equal(globalHelp.ok, true);
	assert.equal(globalHelp.exitCode, 0);
	assert.match(globalHelp.message, /Usage:/);
	assert.match(globalHelp.message, /prodex pack \[root\]/);
	assert.equal(globalHelp.runs.length, 0);

	const shortHelp = await runProdexCommand(["node", "prodex", "-h"], repoRoot);
	assert.equal(shortHelp.ok, true);
	assert.equal(shortHelp.exitCode, 0);
	assert.match(shortHelp.message, /Global options:/);
	assert.equal(shortHelp.runs.length, 0);

	const packHelp = await runProdexCommand(["node", "prodex", "pack", "--help"], repoRoot);
	assert.equal(packHelp.ok, true);
	assert.equal(packHelp.exitCode, 0);
	assert.match(packHelp.message, /prodex pack/);
	assert.equal(packHelp.runs.length, 0);

	const version = await runProdexCommand(["node", "prodex", "--version"], repoRoot);
	assert.equal(version.ok, true);
	assert.equal(version.exitCode, 0);
	assert.match(version.message, /^prodex v/);
	assert.equal(version.runs.length, 0);
});

test("commands are mandatory and invalid commands fail", async () => {
	const result = await runProdexCommand(["node", "prodex", "--entry", "src/index.ts"], repoRoot);
	assert.equal(result.ok, false);
	assert.equal(result.exitCode, 1);
	assert.match(result.errors.join("\n"), /Unknown command/);
	assert.equal(result.runs.length, 0);
});

test("legacy CLI commands fail with guided errors", async () => {
	const runCmd = await runProdexCommand(["node", "prodex", "run"], repoRoot);
	assert.equal(runCmd.ok, false);
	assert.equal(runCmd.exitCode, 1);
	assert.match(runCmd.errors.join("\n"), /prodex run.*has been replaced/i);

	const profilesCmd = await runProdexCommand(["node", "prodex", "profiles"], repoRoot);
	assert.equal(profilesCmd.ok, false);
	assert.equal(profilesCmd.exitCode, 1);
	assert.match(profilesCmd.errors.join("\n"), /prodex profiles.*has been replaced/i);
});

test("legacy CLI flags fail with guided errors", async () => {
	const profileFlag = await runProdexCommand(["node", "prodex", "pack", "--profile", "dashboard"], repoRoot);
	assert.equal(profileFlag.ok, false);
	assert.equal(profileFlag.exitCode, 1);
	assert.match(profileFlag.errors.join("\n"), /--profile.*has been replaced/i);

	const profileFlagShort = await runProdexCommand(["node", "prodex", "pack", "-p", "dashboard"], repoRoot);
	assert.equal(profileFlagShort.ok, false);
	assert.equal(profileFlagShort.exitCode, 1);
	assert.match(profileFlagShort.errors.join("\n"), /--profile.*has been replaced/i);

	const allProfilesFlag = await runProdexCommand(["node", "prodex", "pack", "--all-profiles"], repoRoot);
	assert.equal(allProfilesFlag.ok, false);
	assert.equal(allProfilesFlag.exitCode, 1);
	assert.match(allProfilesFlag.errors.join("\n"), /--all-profiles.*has been replaced/i);

	const maxDepthFlag = await runProdexCommand(["node", "prodex", "pack", "--max-depth", "3"], repoRoot);
	assert.equal(maxDepthFlag.ok, false);
	assert.equal(maxDepthFlag.exitCode, 1);
	assert.match(maxDepthFlag.errors.join("\n"), /--max-depth.*has been replaced/i);
});

test("unknown flags and invalid roots fail without producing runs", async () => {
	const badFlag = await runProdexCommand(["node", "prodex", "pack", "--wat"], repoRoot);
	assert.equal(badFlag.ok, false);
	assert.equal(badFlag.exitCode, 1);
	assert.deepEqual(badFlag.errors, ['Unknown flag "--wat".']);

	const badRoot = await runProdexCommand(["node", "prodex", "pack", "missing-folder"], repoRoot);
	assert.equal(badRoot.ok, false);
	assert.equal(badRoot.exitCode, 1);
	assert.match(badRoot.errors.join("\n"), /Invalid root path/);
});

test("pack specific validation rules are enforced", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig({
			scopes: { dashboard: { entry: ["src/dashboard.ts"] } }
		}));

		// pack command fails because no source was provided
		const packNoSource = await runProdexCommand(["node", "prodex", "pack"], root);
		assert.equal(packNoSource.ok, false);
		assert.match(packNoSource.errors.join("\n"), /Command "pack" requires at least one source/);

		const result = await runProdexCommand(["node", "prodex", "pack", "--scope", "missing"], root);
		assert.equal(result.ok, false);
		assert.match(result.errors.join("\n"), /Unknown scope "missing"/i);
	});
});

test("trace specific validation rules are enforced", async () => {
	// trace with no --entry fails because --entry is required
	const traceNoEntry = await runProdexCommand(["node", "prodex", "trace"], repoRoot);
	assert.equal(traceNoEntry.ok, false);
	assert.match(traceNoEntry.errors.join("\n"), /Command "trace" requires --entry/);

	const result1 = await runProdexCommand(["node", "prodex", "trace", "-i", "notes/context.md"], repoRoot);
	assert.equal(result1.ok, false);
	assert.match(result1.errors.join("\n"), /trace.*does not accept.*--include/i);

	const result2 = await runProdexCommand(["node", "prodex", "trace", "--scope", "dashboard"], repoRoot);
	assert.equal(result2.ok, false);
	assert.match(result2.errors.join("\n"), /trace.*does not accept.*--scope/i);
});

test("scope specific validation rules are enforced", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig({
			scopes: { dashboard: { entry: ["src/dashboard.ts"] } }
		}));

		const result1 = await runProdexCommand(["node", "prodex", "scope", "-k", "dashboard", "-n", "nope"], root);
		assert.equal(result1.ok, false);
		assert.match(result1.errors.join("\n"), /scope.*does not accept.*--name/i);

		const result2 = await runProdexCommand(["node", "prodex", "scope", "-e", "src/index.ts"], root);
		assert.equal(result2.ok, false);
		assert.match(result2.errors.join("\n"), /scope.*does not accept.*--entry/i);

		const result3 = await runProdexCommand(["node", "prodex", "scope", "--scope", "dashboard"], root);
		assert.equal(result3.ok, false);
		assert.match(result3.errors.join("\n"), /scope.*does not accept.*--scope/i);

		const result4 = await runProdexCommand(["node", "prodex", "scope", "-k", "missing"], root);
		assert.equal(result4.ok, false);
		assert.match(result4.errors.join("\n"), /Unknown scope "missing"/i);

		// scope modes are mutually exclusive
		const exclListKey = await runProdexCommand(["node", "prodex", "scope", "--list", "-k", "dashboard"], root);
		assert.equal(exclListKey.ok, false);
		assert.match(exclListKey.errors.join("\n"), /are mutually exclusive/);

		const exclListAll = await runProdexCommand(["node", "prodex", "scope", "--list", "--all"], root);
		assert.equal(exclListAll.ok, false);
		assert.match(exclListAll.errors.join("\n"), /are mutually exclusive/);

		const exclAllKey = await runProdexCommand(["node", "prodex", "scope", "--all", "-k", "dashboard"], root);
		assert.equal(exclAllKey.ok, false);
		assert.match(exclAllKey.errors.join("\n"), /are mutually exclusive/);
	});
});

test("v5 config migration: dry-run, check, and write", async () => {
	await usingTempProjectAsync(async (root) => {
		const configPath = path.join(root, "prodex.json");
		writeJson(configPath, legacyConfig());

		// 1. Dry run migrate
		const dryResult = await runProdexCommand(["node", "prodex", "migrate"], root);
		assert.equal(dryResult.ok, true);
		assert.equal(dryResult.migration.needed, true);
		assert.equal(dryResult.migration.written, false);
		assert.match(dryResult.migration.changes.join("\n"), /shortcuts -> scopes/);
		assert.match(dryResult.migration.changes.join("\n"), /entry -> scopes.default.entry/);
		assert.match(dryResult.migration.changes.join("\n"), /include -> scopes.default.include/);

		// 2. Migrate check
		const checkResult = await runProdexCommand(["node", "prodex", "migrate", "--check"], root);
		assert.equal(checkResult.ok, false);
		assert.equal(checkResult.exitCode, 1);

		// 3. Write migration
		const writeResult = await runProdexCommand(["node", "prodex", "migrate", "--write"], root);
		assert.equal(writeResult.ok, true);
		assert.equal(writeResult.migration.written, true);

		const migrated = JSON.parse(fs.readFileSync(configPath, "utf8"));
		assert.equal(migrated.version, 5);
		assert.equal(migrated.entry, undefined);
		assert.equal(migrated.include, undefined);
		assert.deepEqual(migrated.exclude, ["node_modules/**"]);
		assert.deepEqual(migrated.aliases, { "@": "resources/js" });
		assert.equal(migrated.depth, 7);
		assert.equal(migrated.maxFiles, 42);
		assert.deepEqual(migrated.scopes.dashboard, {
			name: "dashboard",
			entry: ["src/dashboard.ts"],
			include: ["types/**/*.d.ts"],
			exclude: ["dist/**"],
		});
		assert.deepEqual(migrated.scopes.default, {
			name: "combined",
			entry: ["src/index.ts"],
			include: ["**/*.d.ts"]
		});
	});
});

test("v5 config containing root entry/include is rejected/migrated", async () => {
	await usingTempProjectAsync(async (root) => {
		const configPath = path.join(root, "prodex.json");
		writeJson(configPath, {
			version: 5,
			$schema: "schema",
			entry: ["src/root-entry.ts"],
			include: ["README.md"]
		});

		const checkResult = await runProdexCommand(["node", "prodex", "migrate", "--check"], root);
		assert.equal(checkResult.ok, false);

		const writeResult = await runProdexCommand(["node", "prodex", "migrate", "--write"], root);
		assert.equal(writeResult.ok, true);

		const migrated = JSON.parse(fs.readFileSync(configPath, "utf8"));
		assert.equal(migrated.entry, undefined);
		assert.equal(migrated.include, undefined);
		assert.deepEqual(migrated.scopes.default, {
			entry: ["src/root-entry.ts"],
			include: ["README.md"]
		});
	});
});

test("v5 config migration edge cases: merge scopes.default and prefix name", async () => {
	await usingTempProjectAsync(async (root) => {
		const configPath = path.join(root, "prodex.json");
		writeJson(configPath, {
			version: 4,
			$schema: "schema",
			output: {
				prefix: "my-pref"
			},
			entry: ["src/extra-entry.ts"],
			include: ["extra-inc.txt"],
			scopes: {
				default: {
					entry: ["src/default-entry.ts"],
					include: ["default-inc.txt"]
				}
			}
		});

		const writeResult = await runProdexCommand(["node", "prodex", "migrate", "--write"], root);
		assert.equal(writeResult.ok, true);

		const migrated = JSON.parse(fs.readFileSync(configPath, "utf8"));
		assert.deepEqual(migrated.scopes.default, {
			name: "my-pref",
			entry: ["src/default-entry.ts", "src/extra-entry.ts"],
			include: ["default-inc.txt", "extra-inc.txt"]
		});
	});
});

test("v4 config is detected as legacy and fails runtime commands cleanly", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), v4Config());
		writeFile(path.join(root, "src", "index.ts"), "export const value = 1;\n");

		const result = await runProdexCommand(["node", "prodex", "pack", "-e", "src/index.ts"], root);
		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.match(result.errors.join("\n"), /requires config version 5/);
		assert.match(result.errors.join("\n"), /prodex migrate --write/);
	});
});

test("pack command produces single merged output with MB size", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig({
			scopes: {
				dashboard: {
					name: "frontend-dashboard",
					entry: ["src/dashboard.ts"]
				}
			}
		}));
		writeFile(path.join(root, "src", "index.ts"), "export const index = true;\n");
		writeFile(path.join(root, "src", "dashboard.ts"), "export const dashboard = true;\n");
		writeFile(path.join(root, "notes", "context.md"), "# context\n");

		const result = await runProdexCommand(
			["node", "prodex", "pack", "-e", "src/index.ts", "-i", "notes/context.md", "--scope", "dashboard", "-n", "heaven", "--format", "txt"],
			root
		);

		assert.equal(result.ok, true);
		assert.equal(result.exitCode, 0);
		assert.equal(result.runs.length, 1);
		assert.equal(result.runs[0].mode, "mixed");
		assert.match(path.basename(result.runs[0].outputPath), /^heaven-trace_/);

		const stdout = captureStdout(() => reportCommandResult(result));
		assert.match(stdout, /✓ heaven\s+mixed\s+3 files\s+0\.\d+ MB\s+prodex\/heaven-trace_/);
	});
});

test("trace command produces tracing output and respects depth limit", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src", "index.ts"), 'import "./dep";\n');
		writeFile(path.join(root, "src", "dep.ts"), 'import "./deep";\n');
		writeFile(path.join(root, "src", "deep.ts"), "export const deep = true;\n");

		const result = await runProdexCommand(
			["node", "prodex", "trace", "-e", "src/index.ts", "--depth", "1", "-n", "trace-output", "--format", "txt"],
			root
		);

		assert.equal(result.ok, true);
		assert.equal(result.runs.length, 1);
		assert.equal(result.runs[0].mode, "trace");
		assert.deepEqual(result.runs[0].files.map((file) => path.relative(root, file).replaceAll("\\", "/")).sort(), [
			"src/dep.ts",
			"src/index.ts",
		]);

		const stdout = captureStdout(() => reportCommandResult(result));
		assert.match(stdout, /✓ trace-output\s+trace\s+2 files\s+0\.\d+ MB\s+prodex\/trace-output-trace_/);
	});
});

test("scope command runs multiple scopes separately using configured names", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig({
			scopes: {
				dashboard: {
					name: "frontend-dashboard",
					entry: ["src/dashboard.ts"]
				},
				auth: {
					entry: ["src/auth.ts"]
				}
			}
		}));
		writeFile(path.join(root, "src", "dashboard.ts"), "export const db = 1;\n");
		writeFile(path.join(root, "src", "auth.ts"), "export const au = 1;\n");

		const result = await runProdexCommand(
			["node", "prodex", "scope", "-k", "dashboard,auth", "--format", "txt"],
			root
		);

		assert.equal(result.ok, true);
		assert.equal(result.runs.length, 2);
		assert.match(path.basename(result.runs[0].outputPath), /^frontend-dashboard-trace_/);
		assert.match(path.basename(result.runs[1].outputPath), /^auth-trace_/);

		const stdout = captureStdout(() => reportCommandResult(result));
		assert.match(stdout, /✓ frontend-dashboard\s+trace\s+1 files\s+0\.\d+ MB\s+prodex\/frontend-dashboard-trace_/);
		assert.match(stdout, /✓ auth\s+trace\s+1 files\s+0\.\d+ MB\s+prodex\/auth-trace_/);
	});
});

test("scope command runs all scopes separately using --all", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig({
			scopes: {
				dashboard: { name: "frontend-dashboard", entry: ["src/dashboard.ts"] },
				auth: { entry: ["src/auth.ts"] }
			}
		}));
		writeFile(path.join(root, "src", "dashboard.ts"), "export const db = 1;\n");
		writeFile(path.join(root, "src", "auth.ts"), "export const au = 1;\n");

		const result = await runProdexCommand(
			["node", "prodex", "scope", "--all", "--format", "txt"],
			root
		);

		assert.equal(result.ok, true);
		assert.equal(result.runs.length, 2);
		assert.match(path.basename(result.runs[0].outputPath), /^auth-trace_/);
		assert.match(path.basename(result.runs[1].outputPath), /^frontend-dashboard-trace_/);
	});
});

test("scope command lists configured scopes with --list", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig({
			scopes: {
				dashboard: { entry: ["src/dashboard.ts"] },
				auth: { entry: ["src/auth.ts"] }
			}
		}));

		const result = await runProdexCommand(["node", "prodex", "scope", "--list"], root);
		assert.equal(result.ok, true);
		assert.deepEqual(result.scopes, ["auth", "dashboard"]);
	});
});

test("prodex pack CLI combinations", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src", "index.ts"), "export const index = true;\n");
		writeFile(path.join(root, "README.md"), "# README\n");

		// pack -e src/index.ts uses only CLI entry plus global excludes
		const res1 = await runProdexCommand(["node", "prodex", "pack", "-e", "src/index.ts", "-n", "cli-entry", "--format", "txt"], root);
		assert.equal(res1.ok, true);
		assert.equal(res1.runs[0].entries[0], path.resolve(root, "src/index.ts"));

		// pack -i README.md: include-only works
		const res2 = await runProdexCommand(["node", "prodex", "pack", "-i", "README.md", "-n", "cli-include", "--format", "txt"], root);
		assert.equal(res2.ok, true);
		assert.equal(res2.runs[0].includes[0], "README.md");
	});
});

test("prodex pack with scope ignores scope.name for output and uses CLI name", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig({
			scopes: {
				dashboard: {
					name: "dashboard-output-name",
					entry: ["src/dashboard.ts"]
				}
			}
		}));
		writeFile(path.join(root, "src", "dashboard.ts"), "export const db = 1;\n");

		const res = await runProdexCommand(["node", "prodex", "pack", "--scope", "dashboard", "-n", "heaven", "--format", "txt"], root);
		assert.equal(res.ok, true);
		assert.match(path.basename(res.runs[0].outputPath), /^heaven-trace_/);
	});
});

test("prodex trace uses smart naming if no --name is provided", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src", "index.ts"), "export const index = 1;\n");

		const res = await runProdexCommand(["node", "prodex", "trace", "-e", "src/index.ts", "--format", "txt"], root);
		assert.equal(res.ok, true);
		assert.match(path.basename(res.runs[0].outputPath), /^index-trace_/);
	});
});

test("dry-runs for pack, trace, and scope appear in reporter summary", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig({
			scopes: {
				dashboard: {
					name: "dashboard-name",
					entry: ["src/dashboard.ts"]
				}
			}
		}));
		writeFile(path.join(root, "src", "dashboard.ts"), "export const db = 1;\n");
		writeFile(path.join(root, "README.md"), "# README\n");

		// 1. Pack dry-run
		const packRes = await runProdexCommand(["node", "prodex", "pack", "--dry-run", "-i", "README.md", "-n", "pack-dry"], root);
		assert.equal(packRes.ok, true);
		const packStdout = captureStdout(() => reportCommandResult(packRes));
		assert.match(packStdout, /✓ pack-dry\s+include-only\s+1 files\s+0\.00 MB\s+dry-run/);

		// 2. Trace dry-run
		const traceRes = await runProdexCommand(["node", "prodex", "trace", "--dry-run", "-e", "src/dashboard.ts"], root);
		assert.equal(traceRes.ok, true);
		const traceStdout = captureStdout(() => reportCommandResult(traceRes));
		assert.match(traceStdout, /✓ dashboard\s+trace\s+1 files\s+0\.00 MB\s+dry-run/);

		// 3. Scope dry-run
		const scopeRes = await runProdexCommand(["node", "prodex", "scope", "--dry-run", "-k", "dashboard"], root);
		assert.equal(scopeRes.ok, true);
		const scopeStdout = captureStdout(() => reportCommandResult(scopeRes));
		assert.match(scopeStdout, /✓ dashboard-name\s+trace\s+1 files\s+0\.00 MB\s+dry-run/);
	});
});

test("init creates a config version 5 and refuses accidental overwrite", async () => {
	await usingTempProjectAsync(async (root) => {
		const first = await runProdexCommand(["node", "prodex", "init"], root);
		assert.equal(first.ok, true);
		const created = JSON.parse(fs.readFileSync(path.join(root, "prodex.json"), "utf8"));
		assert.equal(created.version, 5);

		const second = await runProdexCommand(["node", "prodex", "init"], root);
		assert.equal(second.ok, false);
		assert.equal(second.exitCode, 1);
		assert.match(second.errors.join("\n"), /already exists/);
	});
});

function baseConfig(overrides = {}) {
	return {
		version: 5,
		$schema: "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
		output: { dir: "prodex", versioned: true, format: "md" },
		exclude: ["node_modules/**"],
		aliases: {},
		depth: 10,
		maxFiles: 200,
		scopes: {},
		...overrides,
	};
}

function v4Config() {
	return {
		version: 4,
		$schema: "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
		output: { dir: "prodex", versioned: true, format: "md" },
		entry: [],
		include: [],
		exclude: ["node_modules/**"],
		resolve: { aliases: {}, maxDepth: 10, maxFiles: 200 },
		profiles: {
			dashboard: {
				name: "frontend-dashboard",
				entry: ["src/dashboard.ts"],
				include: ["types/**/*.d.ts"],
				exclude: ["dist/**"],
			}
		},
	};
}

function legacyConfig() {
	return {
		version: 3.1,
		$schema: "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
		output: { dir: "prodex", versioned: true, prefix: "combined", format: "md" },
		entry: { files: ["src/index.ts"] },
		resolve: {
			include: ["**/*.d.ts"],
			aliases: { "@": "resources/js" },
			exclude: ["node_modules/**"],
			depth: 7,
			limit: 42,
		},
		shortcuts: {
			dashboard: {
				prefix: "dashboard",
				files: ["src/dashboard.ts"],
				include: ["types/**/*.d.ts"],
				exclude: ["dist/**"],
			},
		},
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
