const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { execSync } = require("node:child_process");

const { createExecutionPlans } = require("../dist/app/planner.js");
const { buildFinalFileSet } = require("../dist/filesystem/file-set.js");
const { runProdexCommand } = require("../dist/index.js");
const { normalizePathOrGlob } = require("../dist/filesystem/path-patterns.js");
const { globScan } = require("../dist/filesystem/glob-scan.js");

function writeFile(filePath, value) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, value, "utf8");
}

function writeJson(filePath, value) {
	writeFile(filePath, JSON.stringify(value, null, 2));
}

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

async function usingTempProject(fn) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-cleanup-test-"));
	try {
		return await fn(root);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

function initGitRepo(root) {
	try {
		execSync("git init", { cwd: root, stdio: "ignore" });
		execSync("git config user.name \"Test User\"", { cwd: root, stdio: "ignore" });
		execSync("git config user.email \"test@example.com\"", { cwd: root, stdio: "ignore" });
	} catch (e) {
		// ignore
	}
}

test("Path shorthand expansion and strictness during planning", async () => {
	await usingTempProject(async (root) => {
		// Create mock directories and files
		writeFile(path.join(root, "src/app/foo.ts"), "const foo = 1;");
		writeFile(path.join(root, "docs/info.txt"), "some docs");

		const userConfig = baseConfig();

		// 1. Directory shorthand recursive expansion
		const plan1 = createExecutionPlans({
			intent: {
				kind: "pack",
				flags: { entry: ["src/app"], include: ["docs"] },
			},
			userConfig,
			root,
		});
		assert.equal(plan1.errors.length, 0);
		assert.deepEqual(plan1.plans[0].entry, ["src/app/**"]);
		assert.deepEqual(plan1.plans[0].include, ["docs/**"]);

		// 2. Trailing slash recursive expansion
		const plan2 = createExecutionPlans({
			intent: {
				kind: "pack",
				flags: { entry: ["src/app/"] },
			},
			userConfig,
			root,
		});
		assert.equal(plan2.errors.length, 0);
		assert.deepEqual(plan2.plans[0].entry, ["src/app/**"]);

		// 3. Exact file paths remain exact
		const plan3 = createExecutionPlans({
			intent: {
				kind: "pack",
				flags: { entry: ["src/app/foo.ts"] },
			},
			userConfig,
			root,
		});
		assert.equal(plan3.errors.length, 0);
		assert.deepEqual(plan3.plans[0].entry, ["src/app/foo.ts"]);

		// 4. Explicit globs remain unchanged
		const plan4 = createExecutionPlans({
			intent: {
				kind: "pack",
				flags: { entry: ["src/**/*.ts"] },
			},
			userConfig,
			root,
		});
		assert.equal(plan4.errors.length, 0);
		assert.deepEqual(plan4.plans[0].entry, ["src/**/*.ts"]);

		// 5. Missing paths/globs remain unchanged (preserves strict behavior)
		const plan5 = createExecutionPlans({
			intent: {
				kind: "pack",
				flags: { entry: ["does/not/exist"] },
			},
			userConfig,
			root,
		});
		assert.equal(plan5.errors.length, 0);
		assert.deepEqual(plan5.plans[0].entry, ["does/not/exist"]);
	});
});

test("Deterministic file ordering in buildFinalFileSet", async () => {
	await usingTempProject(async (root) => {
		writeFile(path.join(root, "src/z.ts"), "");
		writeFile(path.join(root, "src/a.ts"), "");
		writeFile(path.join(root, "src/m.ts"), "");

		const sources = ["src/z.ts", "src/a.ts", "src/m.ts"];
		const result = await buildFinalFileSet({
			root,
			sources,
			include: [],
			exclude: [],
		});

		// Check they are sorted relative to root
		const relResult = result.map((p) => path.relative(root, p).replaceAll("\\", "/"));
		assert.deepEqual(relResult, ["src/a.ts", "src/m.ts", "src/z.ts"]);
	});
});

test("Excludes win over includes in file-set construction", async () => {
	await usingTempProject(async (root) => {
		writeFile(path.join(root, "src/app/foo.ts"), "");
		writeFile(path.join(root, "src/app/bar.ts"), "");

		const result = await buildFinalFileSet({
			root,
			sources: [],
			include: ["src/app/**"],
			exclude: ["src/app/bar.ts"],
		});

		const relResult = result.map((p) => path.relative(root, p).replaceAll("\\", "/"));
		assert.deepEqual(relResult, ["src/app/foo.ts"]);
	});
});

test("Trace target validation and bare-name resolution rules", async () => {
	await usingTempProject(async (root) => {
		// Create mock files
		writeFile(path.join(root, "src/foo/CommonName.ts"), "export class CommonName {}");
		writeFile(path.join(root, "src/bar/commonname.ts"), "export class commonname {}");
		writeJson(path.join(root, "prodex.json"), baseConfig());

		// 1. Trace targets must not have directory shorthand (they remain literal)
		const plan = createExecutionPlans({
			intent: {
				kind: "trace",
				flags: { target: ["src"] },
			},
			userConfig: baseConfig(),
			root,
		});
		assert.equal(plan.errors.length, 0);
		assert.deepEqual(plan.plans[0].target, ["src"]);

		// 2. Case-sensitive target matches correctly
		const run1 = await runProdexCommand(["node", "prodex", "trace", "--target", "CommonName", "--dry-run"], root);
		assert.equal(run1.ok, true);
		assert.equal(run1.runs[0].files.length, 1);
		assert.match(run1.runs[0].files[0], /CommonName\.ts$/);

		// 3. Case-insensitive target matches correctly
		const run2 = await runProdexCommand(["node", "prodex", "trace", "--target", "commonname", "--dry-run"], root);
		assert.equal(run2.ok, true);
		assert.equal(run2.runs[0].files.length, 1);
		assert.match(run2.runs[0].files[0], /commonname\.ts$/);

		// 4. Ambiguity check: searching a name that matches both causes an error
		// (Wait, target resolver uses lowercase for case-insensitive lookup, so if we search "commonname", it matches both!)
		// Let's verify if search for "commonname" or a case-insensitive match throws ambiguity error or similar
		// If we search "CommonName" (exact case), it is step 3: case-sensitive bare name match -> returns 1 file.
		// If we search "commonname" (exact case), it is step 3: case-sensitive matches "commonname.ts" -> returns 1 file.
		// If we search "CoMmOnNaMe", it misses case-sensitive (step 3), and goes to case-insensitive (step 4).
		// Step 4 will find BOTH CommonName.ts and commonname.ts, triggering ambiguity error!
		const run3 = await runProdexCommand(["node", "prodex", "trace", "--target", "CoMmOnNaMe", "--dry-run"], root);
		assert.equal(run3.ok, false);
		assert.match(run3.runs[0].errors.join("\n"), /Ambiguous target "CoMmOnNaMe"/);
	});
});

test("Excludes win over includes globally (pack, trace, scope, git)", async () => {
	await usingTempProject(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig({
			scopes: {
				testScope: {
					name: "test-scope",
					entry: ["src/app"],
					exclude: ["src/app/exclude-me.ts"],
				}
			}
		}));

		writeFile(path.join(root, "src/app/include-me.ts"), "const inc = 1;");
		writeFile(path.join(root, "src/app/exclude-me.ts"), "const exc = 2;");

		execSync("git add .", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"commit all\"", { cwd: root, stdio: "ignore" });

		// 1. Pack with --include and --exclude
		const runPack = await runProdexCommand([
			"node", "prodex", "pack",
			"--include", "src/app",
			"--exclude", "src/app/exclude-me.ts",
			"--dry-run"
		], root);
		assert.equal(runPack.ok, true);
		assert.deepEqual(
			runPack.runs[0].files.map((p) => path.basename(p)),
			["include-me.ts"]
		);

		// 2. Trace with --include and --exclude
		const runTrace = await runProdexCommand([
			"node", "prodex", "trace",
			"--target", "include-me",
			"--include", "src/app",
			"--exclude", "src/app/exclude-me.ts",
			"--dry-run"
		], root);
		assert.equal(runTrace.ok, true);
		assert.deepEqual(
			runTrace.runs[0].files.map((p) => path.basename(p)),
			["include-me.ts"]
		);

		// 3. Scope run respects scope exclude winning over scope entry/include
		const runScope = await runProdexCommand([
			"node", "prodex", "scope",
			"--key", "testScope",
			"--dry-run"
		], root);
		assert.equal(runScope.ok, true);
		assert.deepEqual(
			runScope.runs[0].files.map((p) => path.basename(p)),
			["include-me.ts"]
		);

		// 4. Git changes with --include and --exclude
		// Modify both files to make them changed
		writeFile(path.join(root, "src/app/include-me.ts"), "const inc = 1; // modified");
		writeFile(path.join(root, "src/app/exclude-me.ts"), "const exc = 2; // modified");

		const runGitCmd = await runProdexCommand([
			"node", "prodex", "git",
			"--changed",
			"--exclude", "src/app/exclude-me.ts",
			"--dry-run"
		], root);
		assert.equal(runGitCmd.ok, true);
		assert.deepEqual(
			runGitCmd.runs[0].files.map((p) => path.basename(p)),
			["include-me.ts"]
		);
	});
});

test("Role-aware path/glob normalization rules", async () => {
	await usingTempProject(async (root) => {
		// Create an existing directory and file
		const existingDir = path.join(root, "existing-dir");
		fs.mkdirSync(existingDir, { recursive: true });
		const existingFile = path.join(root, "README");
		writeFile(existingFile, "exists");

		// 1. Exclude/skip role expands non-existing directory-like inputs
		assert.equal(normalizePathOrGlob("non-existent-dist", root, { role: "exclude" }), "non-existent-dist/**");
		assert.equal(normalizePathOrGlob("non-existent-dist", root, { role: "skip" }), "non-existent-dist/**");

		// 2. Ambiguous extensionless filenames are treated as directory shorthand and expanded when non-existing
		assert.equal(normalizePathOrGlob("LICENSE", root, { role: "exclude" }), "LICENSE/**");
		assert.equal(normalizePathOrGlob("Dockerfile", root, { role: "exclude" }), "Dockerfile/**");

		// But if they exist as files on disk, they are NOT expanded
		assert.equal(normalizePathOrGlob("README", root, { role: "exclude" }), "README");

		// 3. Include and entry roles do NOT expand non-existing inputs (kept literal)
		assert.equal(normalizePathOrGlob("non-existent-dist", root, { role: "include" }), "non-existent-dist");
		assert.equal(normalizePathOrGlob("non-existent-dist", root, { role: "entry" }), "non-existent-dist");

		// 4. Existing directories still expand for entry/include/exclude/skip
		assert.equal(normalizePathOrGlob("existing-dir", root, { role: "entry" }), "existing-dir/**");
		assert.equal(normalizePathOrGlob("existing-dir", root, { role: "include" }), "existing-dir/**");
		assert.equal(normalizePathOrGlob("existing-dir", root, { role: "exclude" }), "existing-dir/**");
		assert.equal(normalizePathOrGlob("existing-dir", root, { role: "skip" }), "existing-dir/**");
	});
});

test("Absolute and relative exclude pattern matching", async () => {
	await usingTempProject(async (root) => {
		const fileA = path.join(root, "src/app/a.ts");
		const fileB = path.join(root, "src/app/b.ts");
		writeFile(fileA, "a");
		writeFile(fileB, "b");

		// Absolute exclude pattern matches correctly
		const absoluteExclude = path.resolve(root, "src/app/a.ts");
		const result1 = await buildFinalFileSet({
			root,
			sources: [],
			include: ["src/app/**"],
			exclude: [absoluteExclude],
		});
		const relResult1 = result1.map((p) => path.relative(root, p).replaceAll("\\", "/"));
		assert.deepEqual(relResult1, ["src/app/b.ts"]);

		// Relative exclude pattern matches correctly
		const result2 = await buildFinalFileSet({
			root,
			sources: [],
			include: ["src/app/**"],
			exclude: ["src/app/b.ts"],
		});
		const relResult2 = result2.map((p) => path.relative(root, p).replaceAll("\\", "/"));
		assert.deepEqual(relResult2, ["src/app/a.ts"]);
	});
});

test("globScan always returns absolute normalized paths", async () => {
	await usingTempProject(async (root) => {
		writeFile(path.join(root, "src/index.ts"), "content");
		const { files } = await globScan(["src/*.ts"], { cwd: root });
		assert.ok(files.length > 0);
		for (const file of files) {
			assert.ok(path.isAbsolute(file));
			assert.ok(!file.includes("\\")); // Should be normalized to forward slashes
		}
	});
});

test("Trace target glob rejection still works after target-resolver cleanup", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "export const a = 1;");

		const result = await runProdexCommand(["node", "prodex", "trace", "--target", "src/**/*.ts"], root);
		assert.equal(result.ok, false);
		assert.match(result.runs[0].errors.join("\n"), /does not accept glob targets/);
	});
});

test("Line range stress regression test with marker-looking code block contents", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/file1.ts"), [
			"export const x = 1;",
			"// #### 2",
			"// <a id=\"sec-1\"></a>",
			"// <a id=\"cmd-1\"></a>",
			"// <!-- PRODEx v2.0.0 | timestamp -->",
			"// <!-- PRODEX_INDEX_LIST_END -->",
			"```js",
			"console.log('nested code fences tilde vs backtick');",
			"```"
		].join("\n"));
		writeFile(path.join(root, "src/file2.ts"), "export const y = 2;");
		writeFile(path.join(root, "src/file3.ts"), "export const z = 3;");

		const result = await runProdexCommand([
			"node", "prodex", "pack",
			"-e", "src/file1.ts,src/file2.ts,src/file3.ts",
			"--cmd", "node -e \"console.log('#### 3')\"",
			"--format", "md"
		], root);

		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");
		const lines = content.split("\n");

		// Extract index ranges from the TOC listing
		const listStartIdx = lines.findIndex(l => l.trim() === "<!-- PRODEX_INDEX_LIST_START -->");
		const listEndIdx = lines.findIndex(l => l.trim() === "<!-- PRODEX_INDEX_LIST_END -->");
		assert.ok(listStartIdx >= 0 && listEndIdx > listStartIdx);

		const indexLines = lines.slice(listStartIdx + 1, listEndIdx);
		const ranges = [];
		for (const line of indexLines) {
			const m = line.match(/L(\d+)-L(\d+)/);
			if (m) {
				ranges.push({
					label: line,
					start: parseInt(m[1], 10),
					end: parseInt(m[2], 10)
				});
			}
		}

		// Expecting 3 files + 1 command = 4 ranges in TOC
		assert.equal(ranges.length, 4);

		// Assert range properties
		for (let i = 0; i < ranges.length; i++) {
			const r = ranges[i];
			assert.ok(r.start <= r.end, `Inverted range bounds detected: ${r.label} (start ${r.start} > end ${r.end})`);
			if (i > 0) {
				const prev = ranges[i - 1];
				assert.ok(prev.end < r.start, `Overlapping ranges detected: Range ${i-1} (${prev.label}) overlaps with ${i} (${r.label})`);
			}
		}
	});
});

test("Command output layout ordering policy is respected", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "export const value = 1;\n");

		// pack command -> files first, then commands
		const resultPack = await runProdexCommand([
			"node", "prodex", "pack",
			"-e", "src/index.ts",
			"--cmd", "node -e \"console.log('packcmd')\"",
			"--format", "md"
		], root);
		assert.equal(resultPack.ok, true);
		const packContent = fs.readFileSync(resultPack.runs[0].outputPath, "utf8");
		const packFileIdx = packContent.indexOf("#### 1");
		const packCmdIdx = packContent.indexOf("\n# Command Outputs\n");
		assert.ok(packFileIdx < packCmdIdx, "Expected files before command outputs in pack command");
	});
});

test("Renderer command output alignment consistency", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "export const index = 1;");

		const resultMd = await runProdexCommand([
			"node", "prodex", "pack",
			"-e", "src/index.ts",
			"--cmd", "node -e \"process.exit(5)\"",
			"--format", "md"
		], root);
		assert.equal(resultMd.ok, true);
		const contentMd = fs.readFileSync(resultMd.runs[0].outputPath, "utf8");

		const resultTxt = await runProdexCommand([
			"node", "prodex", "pack",
			"-e", "src/index.ts",
			"--cmd", "node -e \"process.exit(5)\"",
			"--format", "txt"
		], root);
		assert.equal(resultTxt.ok, true);
		const contentTxt = fs.readFileSync(resultTxt.runs[0].outputPath, "utf8");

		// Confirm exit code 5 is captured correctly in both
		assert.match(contentMd, /Exit code: 5/);
		assert.match(contentTxt, /Exit Code: 5/);

		// Confirm failed status is captured semantically in both
		assert.match(contentMd, /Status: failed/);
		assert.match(contentTxt, /Status: failed/);
	});
});

test("Git command layout ordering policy is respected", async () => {
	await usingTempProject(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/index.ts"), "export const value = 1;\n");

		try {
			execSync("git add .", { cwd: root, stdio: "ignore" });
			execSync("git commit -m \"commit 1\"", { cwd: root, stdio: "ignore" });
		} catch (e) {
			// Skip or handle git init failures gracefully on host environments lacking git
			return;
		}

		// Mutate file to generate staged/unstaged changes
		writeFile(path.join(root, "src/index.ts"), "export const value = 2;\n");

		const resultGit = await runProdexCommand([
			"node", "prodex", "git",
			"--changed",
			"--format", "md"
		], root);

		assert.equal(resultGit.ok, true);
		const gitContent = fs.readFileSync(resultGit.runs[0].outputPath, "utf8");

		const secAnchorIdx = gitContent.indexOf("<a id=\"sec-1\"></a>");
		const fileMarkerIdx = gitContent.indexOf("#### 1");

		assert.ok(secAnchorIdx >= 0, "Expected a metadata section in git trace");
		assert.ok(fileMarkerIdx >= 0, "Expected a file section in git trace");
		assert.ok(secAnchorIdx < fileMarkerIdx, "Expected metadata sections before file sections in git command");
	});
});


