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
	// trace with no --target fails because --target is required
	const traceNoTarget = await runProdexCommand(["node", "prodex", "trace"], repoRoot);
	assert.equal(traceNoTarget.ok, false);
	assert.match(traceNoTarget.errors.join("\n"), /Command "trace" requires --target/);

	// trace with --entry fails with the removal message
	const traceWithEntry = await runProdexCommand(["node", "prodex", "trace", "--entry", "src/index.ts"], repoRoot);
	assert.equal(traceWithEntry.ok, false);
	assert.match(traceWithEntry.errors.join("\n"), /`prodex trace --entry` has been removed/);

	// trace with --target but no --depth warns and uses configured default depth (but fails because target is missing)
	const traceNoDepth = await runProdexCommand(["node", "prodex", "trace", "--target", "userService"], repoRoot);
	assert.equal(traceNoDepth.ok, false);
	assert.match(traceNoDepth.warnings.join("\n"), /No --depth provided. Using configured default depth/);
	assert.match(traceNoDepth.runs[0].errors.join("\n"), /Target "userService" did not match any files/);

	// trace with --target and invalid depth fails
	const traceInvalidDepth = await runProdexCommand(["node", "prodex", "trace", "--target", "userService", "--depth", "-2"], repoRoot);
	assert.equal(traceInvalidDepth.ok, false);
	assert.match(traceInvalidDepth.errors.join("\n"), /--depth must be an integer greater than or equal to 0/);

	const traceFloatDepth = await runProdexCommand(["node", "prodex", "trace", "--target", "userService", "--depth", "1.5"], repoRoot);
	assert.equal(traceFloatDepth.ok, false);
	assert.match(traceFloatDepth.errors.join("\n"), /--depth must be an integer greater than or equal to 0/);

	// trace with --scope is still rejected
	const result2 = await runProdexCommand(["node", "prodex", "trace", "--target", "userService", "--depth", "1", "--scope", "dashboard"], repoRoot);
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
		writeFile(path.join(root, "src", "index.js"), 'import "./dep";\n');
		writeFile(path.join(root, "src", "dep.js"), 'import "./deep";\n');
		writeFile(path.join(root, "src", "deep.js"), "export const deep = true;\n");

		const result = await runProdexCommand(
			["node", "prodex", "trace", "-t", "src/index.js", "--depth", "1", "-n", "trace-output", "--format", "txt"],
			root
		);

		assert.equal(result.ok, true);
		assert.equal(result.runs.length, 1);
		assert.equal(result.runs[0].mode, "trace");
		assert.deepEqual(result.runs[0].files.map((file) => path.relative(root, file).replaceAll("\\", "/")).sort(), [
			"src/dep.js",
			"src/index.js",
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
		assert.equal(res1.runs[0].entries[0], path.resolve(root, "src/index.ts").replaceAll("\\", "/"));

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

		const res = await runProdexCommand(["node", "prodex", "trace", "-t", "src/index.ts", "--depth", "0", "--format", "txt"], root);
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
		const traceRes = await runProdexCommand(["node", "prodex", "trace", "--dry-run", "-t", "src/dashboard.ts", "--depth", "0"], root);
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

test("trace target and strict entry behavior", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "import './helper';\nexport const index = true;\n");
		writeFile(path.join(root, "src/helper.ts"), "export const helper = true;\n");
		writeFile(path.join(root, "src/main.js"), "import './sub';\nexport const main = true;\n");
		writeFile(path.join(root, "src/sub.js"), "export const sub = true;\n");
		writeFile(path.join(root, "resources/js/pages/Dashboard.tsx"), "export const dash = 1;\n");
		writeFile(path.join(root, "README.md"), "# README\n");

		// 1. pack --entry accepts exact paths
		const packExact = await runProdexCommand(["node", "prodex", "pack", "--entry", "src/index.ts", "-n", "p-exact", "--format", "txt"], root);
		assert.equal(packExact.ok, true);
		assert.deepEqual(packExact.runs[0].entries.map(f => path.basename(f)).sort(), ["index.ts"]);

		// 2. pack --entry accepts globs
		const packGlob = await runProdexCommand(["node", "prodex", "pack", "--entry", "src/*.ts", "-n", "p-glob", "--format", "txt"], root);
		assert.equal(packGlob.ok, true);
		assert.deepEqual(packGlob.runs[0].entries.map(f => path.basename(f)).sort(), ["helper.ts", "index.ts"]);

		// 3. pack --entry index fails if no literal/glob match exists
		const packFail = await runProdexCommand(["node", "prodex", "pack", "--entry", "index", "-n", "p-fail", "--format", "txt"], root);
		assert.equal(packFail.ok, false);
		assert.match(packFail.runs[0].errors.join("\n"), /Entry "index" did not match any files/);

		// 4. trace --entry fails with the removal message
		const traceEntryFail = await runProdexCommand(["node", "prodex", "trace", "--entry", "src/index.ts"], root);
		assert.equal(traceEntryFail.ok, false);
		assert.match(traceEntryFail.errors.join("\n"), /`prodex trace --entry` has been removed/);

		// 5. trace without --target fails
		const traceNoTarget = await runProdexCommand(["node", "prodex", "trace", "--depth", "1"], root);
		assert.equal(traceNoTarget.ok, false);
		assert.match(traceNoTarget.errors.join("\n"), /Command "trace" requires --target/);

		// 6. trace -t auth without --depth proceeds using configured depth and warns
		const traceNoDepth = await runProdexCommand(["node", "prodex", "trace", "--target", "src/main.js", "--format", "txt"], root);
		assert.equal(traceNoDepth.ok, true);
		assert.match(traceNoDepth.warnings.join("\n"), /No --depth provided. Using configured default depth: 2/);
		assert.deepEqual(traceNoDepth.runs[0].files.map(f => path.basename(f)).sort(), ["main.js", "sub.js"]);

		// trace -t auth --depth 4 uses CLI depth and does not emit the default-depth warning
		const traceWithDepth = await runProdexCommand(["node", "prodex", "trace", "--target", "src/main.js", "--depth", "1", "--format", "txt"], root);
		assert.equal(traceWithDepth.ok, true);
		assert.equal(traceWithDepth.warnings.length, 0);

		// trace -t auth -d 4 works as a depth override
		const traceWithShortDepth = await runProdexCommand(["node", "prodex", "trace", "--target", "src/main.js", "-d", "1", "--format", "txt"], root);
		assert.equal(traceWithShortDepth.ok, true);
		assert.equal(traceWithShortDepth.warnings.length, 0);
		assert.deepEqual(traceWithShortDepth.runs[0].files.map(f => path.basename(f)).sort(), ["main.js", "sub.js"]);

		// invalid configured depth fails clearly
		writeJson(path.join(root, "prodex.json"), baseConfig({ depth: -1 }));
		const traceInvalidConfigDepth = await runProdexCommand(["node", "prodex", "trace", "--target", "src/main.js"], root);
		assert.equal(traceInvalidConfigDepth.ok, false);
		assert.match(traceInvalidConfigDepth.errors.join("\n"), /--depth must be an integer greater than or equal to 0/);
		// restore base config
		writeJson(path.join(root, "prodex.json"), baseConfig());

		// --debug remains accepted only as long form
		const traceDebugLong = await runProdexCommand(["node", "prodex", "trace", "--target", "src/main.js", "--depth", "0", "--debug"], root);
		assert.equal(traceDebugLong.ok, true);

		// -d no longer means debug
		const traceDebugShort = await runProdexCommand(["node", "prodex", "trace", "--target", "src/main.js", "-d"], root);
		assert.equal(traceDebugShort.ok, false);
		assert.match(traceDebugShort.errors.join("\n"), /Flag "-d" expects a value/);

		// 7. trace --target x --depth 0 includes only the resolved target file
		const traceDepth0 = await runProdexCommand(["node", "prodex", "trace", "--target", "src/main.js", "--depth", "0", "--format", "txt"], root);
		assert.equal(traceDepth0.ok, true);
		assert.deepEqual(traceDepth0.runs[0].files.map(f => path.basename(f)).sort(), ["main.js"]);

		// 8. trace --target x --depth 1 includes direct dependencies
		const traceDepth1 = await runProdexCommand(["node", "prodex", "trace", "--target", "src/main.js", "--depth", "1", "--format", "txt"], root);
		assert.equal(traceDepth1.ok, true);
		assert.deepEqual(traceDepth1.runs[0].files.map(f => path.basename(f)).sort(), ["main.js", "sub.js"]);

		// 9. trace --target index --depth 1 resolves uniquely when one match exists
		const traceUnique = await runProdexCommand(["node", "prodex", "trace", "--target", "dashboard", "--depth", "0", "--format", "txt"], root);
		assert.equal(traceUnique.ok, true);
		assert.deepEqual(traceUnique.runs[0].files.map(f => path.basename(f)).sort(), ["Dashboard.tsx"]);

		// 10. trace --target index --depth 1 fails with listed matches when ambiguous
		writeFile(path.join(root, "resources/js/components/Dashboard.tsx"), "export const comp = 1;\n");
		const traceAmbig = await runProdexCommand(["node", "prodex", "trace", "--target", "dashboard", "--depth", "1"], root);
		assert.equal(traceAmbig.ok, false);
		assert.match(traceAmbig.runs[0].errors.join("\n"), /Ambiguous target "dashboard"/);
		assert.match(traceAmbig.runs[0].errors.join("\n"), /resources\/js\/pages\/Dashboard\.tsx/);
		assert.match(traceAmbig.runs[0].errors.join("\n"), /resources\/js\/components\/Dashboard\.tsx/);
		// Clean up components Dashboard
		fs.rmSync(path.join(root, "resources/js/components/Dashboard.tsx"), { force: true });

		// 11. trace --target missing --depth 1 fails clearly
		const traceMissing = await runProdexCommand(["node", "prodex", "trace", "--target", "missing", "--depth", "1"], root);
		assert.equal(traceMissing.ok, false);
		assert.match(traceMissing.runs[0].errors.join("\n"), /Target "missing" did not match any files/);

		// 12. trace --target "src/**/*.ts" --depth 1 fails because globs are not valid targets
		const traceGlob = await runProdexCommand(["node", "prodex", "trace", "--target", "src/**/*.ts", "--depth", "1"], root);
		assert.equal(traceGlob.ok, false);
		assert.match(traceGlob.runs[0].errors.join("\n"), /Command "trace" does not accept glob targets/);

		// 13. trace --include appends files directly and does not create trace roots
		const traceInclude = await runProdexCommand(["node", "prodex", "trace", "--target", "dashboard", "--depth", "0", "--include", "README.md", "--format", "txt"], root);
		assert.equal(traceInclude.ok, true);
		assert.deepEqual(traceInclude.runs[0].files.map(f => path.basename(f)).sort(), ["Dashboard.tsx", "README.md"]);
	});
});

function baseConfig(overrides = {}) {
	return {
		version: 5,
		$schema: "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
		output: { dir: "prodex", versioned: true, format: "md" },
		exclude: ["node_modules/**"],
		aliases: {},
		depth: 2,
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

test("scope -k and scope --all with --cmd", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig({
			scopes: {
				dashboard: { entry: ["src/dashboard.ts"] }
			}
		}));
		writeFile(path.join(root, "src/dashboard.ts"), "export const a = 1;");

		const result1 = await runProdexCommand(
			["node", "prodex", "scope", "-k", "dashboard", "--cmd", "node -e \"console.log('first command')\"", "--format", "txt"],
			root
		);
		assert.equal(result1.ok, true);
		assert.equal(result1.runs.length, 1);
		const content1 = fs.readFileSync(result1.runs[0].outputPath, "utf8");
		assert.match(content1, /##==== Command Attachments ====/);
		assert.match(content1, /first command/);

		const result2 = await runProdexCommand(
			["node", "prodex", "scope", "--all", "--cmd", "node -e \"console.log('second command')\"", "--format", "md"],
			root
		);
		assert.equal(result2.ok, true);
		assert.equal(result2.runs.length, 1);
		const content2 = fs.readFileSync(result2.runs[0].outputPath, "utf8");
		assert.match(content2, /# Command Outputs/);
		assert.match(content2, /second command/);
	});
});

test("scope --list --cmd is rejected", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig({
			scopes: {
				dashboard: { entry: ["src/dashboard.ts"] }
			}
		}));

		const result = await runProdexCommand(
			["node", "prodex", "scope", "--list", "--cmd", "node -e \"console.log('list')\""],
			root
		);
		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.match(result.errors.join("\n"), /Option "--list" cannot be used with command/);
	});
});

test("raw command value with commas is not split", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "export const a = 1;");

		const result = await runProdexCommand(
			["node", "prodex", "pack", "-e", "src/index.ts", "--cmd", "node -e \"console.log('arg1, arg2')\"", "--format", "txt"],
			root
		);
		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");
		assert.match(content, /arg1, arg2/);
	});
});

test("stable snapshot matches original content even if a command mutates it", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		const fileA = path.join(root, "src/a.ts");
		writeFile(fileA, "export const original = 'yes';");

		// Execute pack with a command that overwrites src/a.ts to 'mutated'
		const result = await runProdexCommand(
			[
				"node",
				"prodex",
				"pack",
				"-e",
				"src/a.ts",
				"--cmd",
				`node -e "require('fs').writeFileSync('${fileA.replace(/\\/g, "/")}', 'export const original = \\'mutated\\';')\"`,
				"--format",
				"txt"
			],
			root
		);
		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");
		// The generated artifact must contain the original content, not the mutated content
		assert.match(content, /original = 'yes'/);
		assert.doesNotMatch(content, /original = 'mutated'/);

		// But the file on disk should indeed be mutated
		const diskContent = fs.readFileSync(fileA, "utf8");
		assert.match(diskContent, /original = 'mutated'/);
	});
});

test("default failed command writes artifact and exits success", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "export const a = 1;");

		const result = await runProdexCommand(
			["node", "prodex", "pack", "-e", "src/index.ts", "--cmd", "node -e \"process.exit(1)\"", "--format", "txt"],
			root
		);
		assert.equal(result.ok, true);
		assert.equal(result.exitCode, 0);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");
		assert.match(content, /status: failed/i);
		assert.match(content, /Exit Code: 1/);
	});
});

test("strict failed command writes artifact and exits failure", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "export const a = 1;");

		const result = await runProdexCommand(
			["node", "prodex", "pack", "-e", "src/index.ts", "--cmd", "node -e \"process.exit(5)\"", "--fail-on-cmd-error", "--format", "txt"],
			root
		);
		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");
		assert.match(content, /status: failed/i);
		assert.match(content, /Exit Code: 5/);
	});
});

test("command timeout writes artifact and sets timed-out status", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "export const a = 1;");

		const startTime = Date.now();
		const result = await runProdexCommand(
			["node", "prodex", "pack", "-e", "src/index.ts", "--cmd", "node -e \"setTimeout(() => {}, 10000)\"", "--cmd-timeout", "1", "--format", "txt"],
			root
		);
		const elapsed = Date.now() - startTime;
		assert.ok(elapsed < 4000, `Expected elapsed time to be less than 4s, but got ${elapsed}ms`);
		assert.equal(result.ok, true);
		assert.equal(result.exitCode, 0);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");
		assert.match(content, /status: timed-out/i);
		assert.match(content, /Timeout State: Yes/);
	});
});

test("dry-run does not execute commands and reports planned commands", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "export const a = 1;");

		const result = await runProdexCommand(
			["node", "prodex", "pack", "-e", "src/index.ts", "--cmd", "node -e \"console.log('should-not-run')\"", "--dry-run"],
			root
		);
		assert.equal(result.ok, true);
		assert.deepEqual(result.runs[0].plannedCommands, ["node -e \"console.log('should-not-run')\""]);

		const stdout = captureStdout(() => reportCommandResult(result));
		assert.match(stdout, /Planned command attachments to run in sequence/);
		assert.match(stdout, /node -e "console\.log\('should-not-run'\)"/);
	});
});

test("command attachment flags are rejected for non-artifact commands", async () => {
	await usingTempProjectAsync(async (root) => {
		const resultInit = await runProdexCommand(
			["node", "prodex", "init", "--cmd", "echo 1"],
			root
		);
		assert.equal(resultInit.ok, false);
		assert.match(resultInit.errors.join("\n"), /does not accept command attachment options/i);

		const resultMigrate = await runProdexCommand(
			["node", "prodex", "migrate", "--fail-on-cmd-error"],
			root
		);
		assert.equal(resultMigrate.ok, false);
		assert.match(resultMigrate.errors.join("\n"), /does not accept command attachment options/i);
	});
});

test("blank cmd or command options without cmd are rejected", async () => {
	await usingTempProjectAsync(async (root) => {
		const resultBlank = await runProdexCommand(
			["node", "prodex", "pack", "-e", "src/index.ts", "--cmd", "   "],
			root
		);
		assert.equal(resultBlank.ok, false);
		assert.match(resultBlank.errors.join("\n"), /cannot be blank/i);

		const resultNoCmd = await runProdexCommand(
			["node", "prodex", "pack", "-e", "src/index.ts", "--cmd-timeout", "10"],
			root
		);
		assert.equal(resultNoCmd.ok, false);
		assert.match(resultNoCmd.errors.join("\n"), /require providing at least one command/i);
	});
});

test("md index range analysis bounds files correctly and excludes command outputs", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "export const a = 1;");

		const result = await runProdexCommand(
			["node", "prodex", "pack", "-e", "src/index.ts", "--cmd", "node -e \"console.log('command output content')\"", "--format", "md"],
			root
		);
		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");

		const match = content.match(/<!-- PRODEX_INDEX_RANGE: L(\d+)-L(\d+) -->/);
		assert.ok(match, "Expected index range comment in output markdown");
		const endLine = parseInt(match[2], 10);

		const lines = content.split("\n");
		const cmdOutputsLineIndex = lines.findIndex(l => l.trim() === "# Command Outputs");
		assert.ok(cmdOutputsLineIndex > 0, "Expected command outputs header in markdown");

		assert.ok(endLine < cmdOutputsLineIndex + 1, `Expected index range end ${endLine} to be before Command Outputs section at line ${cmdOutputsLineIndex + 1}`);
	});
});

test("failed-but-written runs are reported with a cross icon and correct artifact path", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "export const a = 1;");

		const result = await runProdexCommand(
			["node", "prodex", "pack", "-e", "src/index.ts", "--cmd", "node -e \"process.exit(1)\"", "--fail-on-cmd-error", "--format", "txt"],
			root
		);
		assert.equal(result.ok, false);
		const stdout = captureStdout(() => reportCommandResult(result));
		assert.match(stdout, /✗/);
		assert.match(stdout, /pack-combined/);
		assert.match(stdout, /prodex\/pack-combined-trace_/);
	});
});

test("Markdown output indexing and navigation details are correct", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "export const a = 1;");
		writeFile(path.join(root, "src/helper.ts"), "export const b = 2;");

		// 1. Markdown with command outputs
		const result = await runProdexCommand(
			[
				"node",
				"prodex",
				"pack",
				"-e",
				"src/index.ts,src/helper.ts",
				"--cmd",
				"node -e \"console.log('cmd1')\"",
				"--cmd",
				"node -e \"console.log('cmd2')\"",
				"--format",
				"md"
			],
			root
		);
		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");

		// Verify Index Headers
		assert.match(content, /<!-- PRODEX_FILE_COUNT: 2 -->/);
		assert.match(content, /<!-- PRODEX_COMMAND_OUTPUT_COUNT: 2 -->/);
		assert.match(content, /## Files/);
		assert.match(content, /## Command Outputs/);

		// Verify command output index entries
		assert.match(content, /- \[Command 1: node -e "console\.log\('cmd1'\)"\]\(#cmd-1\)/);
		assert.match(content, /- \[Command 2: node -e "console\.log\('cmd2'\)"\]\(#cmd-2\)/);

		// Verify line ranges on command index entries
		assert.match(content, /- \[Command 1: node -e "console\.log\('cmd1'\)"\]\(#cmd-1\) L\d+-L\d+/);
		assert.match(content, /- \[Command 2: node -e "console\.log\('cmd2'\)"\]\(#cmd-2\) L\d+-L\d+/);

		// Verify PRODEX_INDEX_RANGE contains both files and command entries
		const rangeMatch = content.match(/<!-- PRODEX_INDEX_RANGE: L(\d+)-L(\d+) -->/);
		assert.ok(rangeMatch);
		const startLine = parseInt(rangeMatch[1], 10);
		const endLine = parseInt(rangeMatch[2], 10);

		const lines = content.split("\n");
		// Find list start/end
		const listStartIdx = lines.findIndex(l => l.trim() === "<!-- PRODEX_INDEX_LIST_START -->");
		const listEndIdx = lines.findIndex(l => l.trim() === "<!-- PRODEX_INDEX_LIST_END -->");

		// Files list index start should be close to listStartIdx
		assert.ok(startLine > listStartIdx);
		assert.ok(endLine < listEndIdx + 2); // since endLine is 1-based and index matches listingEnd

		// Verify anchors exist
		assert.match(content, /<a id="cmd-1"><\/a>/);
		assert.match(content, /<a id="cmd-2"><\/a>/);

		// Verify source section navigation (linear chain)
		// File 1 navigation: Back to top, Next
		assert.match(content, /\[Back to top\]\(#index\) \| \[Next\]\(#2\)/);
		// File 2 (last file) navigation: Previous, Back to top, Next (pointing to cmd-1)
		assert.match(content, /\[Previous\]\(#1\) \| \[Back to top\]\(#index\) \| \[Next\]\(#cmd-1\)/);

		// Assert source nav does not contain the literal "Command outputs" shortcut
		assert.doesNotMatch(content, /\[Command outputs\]/);

		// Verify command output section navigation
		// Command 1: Previous (pointing to last file #2), Back to top, Next (pointing to cmd-2)
		assert.match(content, /\[Previous\]\(#2\) \| \[Back to top\]\(#index\) \| \[Next\]\(#cmd-2\)/);
		// Command 2: Previous, Back to top
		assert.match(content, /\[Previous\]\(#cmd-1\) \| \[Back to top\]\(#index\)/);

		// Verify ranges do not overlap
		const indexRangeLines = lines.slice(listStartIdx + 1, listEndIdx);
		// Gather Lx-Ly ranges
		const ranges = [];
		for (const line of indexRangeLines) {
			const m = line.match(/L(\d+)-L(\d+)/);
			if (m) {
				ranges.push({ start: parseInt(m[1], 10), end: parseInt(m[2], 10) });
			}
		}
		assert.equal(ranges.length, 4); // 2 files + 2 commands
		for (let i = 0; i < ranges.length - 1; i++) {
			assert.ok(ranges[i].end < ranges[i+1].start, `Range overlap: range ${i} end ${ranges[i].end} is not before range ${i+1} start ${ranges[i+1].start}`);
		}

		// Assert the last command output range has end > start
		const lastCmdRange = ranges[3];
		assert.ok(lastCmdRange.end > lastCmdRange.start, `Expected last command range to span multiple lines, but got ${lastCmdRange.start}-${lastCmdRange.end}`);

		// Assert command output ranges cover their actual rendered sections
		const cmd1Range = ranges[2];
		const cmd1StartText = lines[cmd1Range.start - 1];
		assert.ok(
			cmd1StartText.includes("---") || cmd1StartText.includes("id=\"cmd-1\""),
			`Expected start of command 1 range to be separator or anchor, got: ${cmd1StartText}`
		);

		const cmd1EndText = lines[cmd1Range.end - 1];
		assert.ok(
			cmd1EndText.trim() === "```" || cmd1EndText.trim() === "---" || cmd1EndText.trim() === "",
			`Expected end of command 1 range to be fence or separator, got: ${cmd1EndText}`
		);

		const cmd2StartText = lines[lastCmdRange.start - 1];
		assert.ok(
			cmd2StartText.includes("---") || cmd2StartText.includes("id=\"cmd-2\""),
			`Expected start of command 2 range to be separator or anchor, got: ${cmd2StartText}`
		);

		const cmd2EndText = lines[lastCmdRange.end - 1];
		assert.ok(
			cmd2EndText.trim() === "```" || cmd2EndText.trim() === "---" || cmd2EndText.trim() === "",
			`Expected end of command 2 range to be fence or separator, got: ${cmd2EndText}`
		);
	});
});

test("Markdown with no command outputs does not render command output index group", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "export const a = 1;");

		const result = await runProdexCommand(
			["node", "prodex", "pack", "-e", "src/index.ts", "--format", "md"],
			root
		);
		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");

		assert.doesNotMatch(content, /## Files/);
		assert.doesNotMatch(content, /## Command Outputs/);
		assert.doesNotMatch(content, /PRODEX_COMMAND_OUTPUT_COUNT/);
		// Verify source navigation has no command outputs link
	});
});

test("help rendering is dynamic and shows correct options per command", async () => {
	const traceHelp = await runProdexCommand(["node", "prodex", "trace", "--help"], repoRoot);
	assert.equal(traceHelp.ok, true);
	assert.equal(traceHelp.exitCode, 0);
	assert.match(traceHelp.message, /--target/);
	assert.match(traceHelp.message, /Dependency traversal depth/);
	assert.doesNotMatch(traceHelp.message, /--entry/);
	assert.doesNotMatch(traceHelp.message, /--debug/);

	const packHelp = await runProdexCommand(["node", "prodex", "pack", "--help"], repoRoot);
	assert.equal(packHelp.ok, true);
	assert.equal(packHelp.exitCode, 0);
	assert.match(packHelp.message, /--entry/);
	assert.doesNotMatch(packHelp.message, /--target/);
	assert.doesNotMatch(packHelp.message, /--debug/);

	const scopeHelp = await runProdexCommand(["node", "prodex", "scope", "--help"], repoRoot);
	assert.equal(scopeHelp.ok, true);
	assert.equal(scopeHelp.exitCode, 0);
	assert.match(scopeHelp.message, /--key/);
	assert.match(scopeHelp.message, /--all/);
	assert.match(scopeHelp.message, /--list/);
	assert.doesNotMatch(scopeHelp.message, /--debug/);

	const gitHelp = await runProdexCommand(["node", "prodex", "git", "--help"], repoRoot);
	assert.equal(gitHelp.ok, true);
	assert.equal(gitHelp.exitCode, 0);
	assert.match(gitHelp.message, /--changed/);
	assert.match(gitHelp.message, /--staged/);
	assert.match(gitHelp.message, /--unstaged/);
	assert.match(gitHelp.message, /--untracked/);
	assert.match(gitHelp.message, /--include-diff/);
	assert.doesNotMatch(gitHelp.message, /--debug/);

	const grepHelp = await runProdexCommand(["node", "prodex", "grep", "--help"], repoRoot);
	assert.equal(grepHelp.ok, true);
	assert.equal(grepHelp.exitCode, 0);
	assert.match(grepHelp.message, /--query/);
	assert.match(grepHelp.message, /--any/);
	assert.match(grepHelp.message, /--all/); // grep --all internally uses grepAll but CLI flag is --all
	assert.match(grepHelp.message, /--regex/);
	assert.match(grepHelp.message, /--not/);
	assert.match(grepHelp.message, /--within/);
	assert.match(grepHelp.message, /--skip/);
	assert.doesNotMatch(grepHelp.message, /--debug/);

	const migrateHelp = await runProdexCommand(["node", "prodex", "migrate", "--help"], repoRoot);
	assert.equal(migrateHelp.ok, true);
	assert.equal(migrateHelp.exitCode, 0);
	assert.match(migrateHelp.message, /--write/);
	assert.match(migrateHelp.message, /--check/);
	assert.doesNotMatch(migrateHelp.message, /--debug/);
});

test("git command help includes historical flags", async () => {
	const gitHelp = await runProdexCommand(["node", "prodex", "git", "--help"], repoRoot);
	assert.equal(gitHelp.ok, true);
	assert.equal(gitHelp.exitCode, 0);
	assert.match(gitHelp.message, /--commit/);
	assert.match(gitHelp.message, /--range/);
	assert.match(gitHelp.message, /--against/);
});

test("git historical modes mutual exclusivity and validation", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());

		// Group B exclusivity
		const res1 = await runProdexCommand(["node", "prodex", "git", "--commit", "abc", "--range", "base..head"], root);
		assert.equal(res1.ok, false);
		assert.match(res1.errors.join("\n"), /--commit, --range, and --against are mutually exclusive/);

		const res2 = await runProdexCommand(["node", "prodex", "git", "--commit", "abc", "--against", "main"], root);
		assert.equal(res2.ok, false);
		assert.match(res2.errors.join("\n"), /--commit, --range, and --against are mutually exclusive/);

		const res3 = await runProdexCommand(["node", "prodex", "git", "--range", "base..head", "--against", "main"], root);
		assert.equal(res3.ok, false);
		assert.match(res3.errors.join("\n"), /--commit, --range, and --against are mutually exclusive/);

		// Group A and Group B combination
		const res4 = await runProdexCommand(["node", "prodex", "git", "--commit", "abc", "--changed"], root);
		assert.equal(res4.ok, false);
		assert.match(res4.errors.join("\n"), /cannot be combined with --changed/);

		const res5 = await runProdexCommand(["node", "prodex", "git", "--range", "base..head", "--staged"], root);
		assert.equal(res5.ok, false);
		assert.match(res5.errors.join("\n"), /cannot be combined with --changed/);

		// Empty or invalid inputs
		const res6 = await runProdexCommand(["node", "prodex", "git", "--commit", "  "], root);
		assert.equal(res6.ok, false);
		assert.match(res6.errors.join("\n"), /--commit requires a non-empty revision/);

		const res7 = await runProdexCommand(["node", "prodex", "git", "--against", "  "], root);
		assert.equal(res7.ok, false);
		assert.match(res7.errors.join("\n"), /--against requires a non-empty base branch/);

		const res8 = await runProdexCommand(["node", "prodex", "git", "--range", "abc"], root);
		assert.equal(res8.ok, false);
		assert.match(res8.errors.join("\n"), /Invalid range format/);

		const res9 = await runProdexCommand(["node", "prodex", "git", "--range", "base.."], root);
		assert.equal(res9.ok, false);
		assert.match(res9.errors.join("\n"), /Invalid range format/);

		const res10 = await runProdexCommand(["node", "prodex", "git", "--range", "..head"], root);
		assert.equal(res10.ok, false);
		assert.match(res10.errors.join("\n"), /Invalid range format/);
	});
});

test("clipboard --copy CLI flag contract tests", async () => {
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

		// 1. --copy parser support across generating commands (pack, scope)
		const parseRes1 = await runProdexCommand(
			["node", "prodex", "pack", "--entry", "src/dashboard.ts", "--copy", "--dry-run"],
			root
		);
		assert.equal(parseRes1.ok, true);

		const parseRes2 = await runProdexCommand(
			["node", "prodex", "scope", "-k", "dashboard", "--copy", "--dry-run"],
			root
		);
		assert.equal(parseRes2.ok, true);

		// 2. --copy rejection on non-generating commands (migrate)
		const parseRes3 = await runProdexCommand(
			["node", "prodex", "migrate", "--copy"],
			root
		);
		assert.equal(parseRes3.ok, false);
		assert.match(parseRes3.errors.join("\n"), /does not accept "--copy"/);

		// 3. scope --all --copy validation
		const multiRes1 = await runProdexCommand(
			["node", "prodex", "scope", "--all", "--copy"],
			root
		);
		assert.equal(multiRes1.ok, false);
		assert.match(
			multiRes1.errors.join("\n"),
			/--copy can only be used when exactly one artifact is generated/
		);

		// 4. scope -k key1,key2 --copy validation
		const multiRes2 = await runProdexCommand(
			["node", "prodex", "scope", "-k", "dashboard,auth", "--copy"],
			root
		);
		assert.equal(multiRes2.ok, false);
		assert.match(
			multiRes2.errors.join("\n"),
			/--copy can only be used when exactly one artifact is generated/
		);

		// 5. dry-run with copy does not execute clipboard logic
		const dryRes = await runProdexCommand(
			["node", "prodex", "pack", "--entry", "src/dashboard.ts", "--dry-run", "--copy"],
			root
		);
		assert.equal(dryRes.ok, true);
		assert.equal(dryRes.runs[0].copied, undefined);
		assert.equal(dryRes.runs[0].copyWarning, undefined);
	});
});

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
