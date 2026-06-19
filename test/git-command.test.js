const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const { runProdexCommand } = require("../dist/index.js");
const { reportCommandResult } = require("../dist/cli/reporter.js");

function initGitRepo(root) {
	try {
		execSync("git init", { cwd: root, stdio: "ignore" });
		execSync("git config user.name \"Test User\"", { cwd: root, stdio: "ignore" });
		execSync("git config user.email \"test@example.com\"", { cwd: root, stdio: "ignore" });
	} catch (e) {
		// ignore
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

test("CLI / planning: git command recognized and validated", async () => {
	await usingTempProjectAsync(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig());

		// 1. git help works
		const gitHelp = await runProdexCommand(["node", "prodex", "git", "--help"], root);
		assert.equal(gitHelp.ok, true);
		assert.equal(gitHelp.exitCode, 0);
		assert.match(gitHelp.message, /Usage:/);
		assert.match(gitHelp.message, /prodex git \[root\]/);

		// 2. command attachment flags are accepted
		writeFile(path.join(root, "src/index.ts"), "const a = 1;");
		execSync("git add src/index.ts", { cwd: root, stdio: "ignore" });

		const gitCmd = await runProdexCommand(["node", "prodex", "git", "--cmd", "node -e \"console.log('from attachment')\"", "--dry-run"], root);
		assert.equal(gitCmd.ok, true);
		assert.deepEqual(gitCmd.runs[0].plannedCommands, ["node -e \"console.log('from attachment')\""]);

		// 3. invalid flags are rejected
		const invalidEntry = await runProdexCommand(["node", "prodex", "git", "--entry", "src/index.ts"], root);
		assert.equal(invalidEntry.ok, false);
		assert.match(invalidEntry.errors.join("\n"), /does not accept "--entry"/);

		const invalidScope = await runProdexCommand(["node", "prodex", "git", "--scope", "default"], root);
		assert.equal(invalidScope.ok, false);
		assert.match(invalidScope.errors.join("\n"), /does not accept.*"--scope"/);

		const invalidDepth = await runProdexCommand(["node", "prodex", "git", "--depth", "5"], root);
		assert.equal(invalidDepth.ok, false);
		assert.match(invalidDepth.errors.join("\n"), /does not accept.*"--depth"/);

		const invalidMaxFiles = await runProdexCommand(["node", "prodex", "git", "--max-files", "10"], root);
		assert.equal(invalidMaxFiles.ok, false);
		assert.match(invalidMaxFiles.errors.join("\n"), /does not accept.*"--max-files"/);
	});
});

test("Git source selection: stages, unstaged, untracked, deleted, renamed, outside repo", async () => {
	// Outside Git repo
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		const result = await runProdexCommand(["node", "prodex", "git"], root);
		assert.equal(result.ok, false);
		assert.match(result.runs[0].errors.join("\n"), /not a git repository/i);
	});

	// Inside Git repo
	await usingTempProjectAsync(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig());
		execSync("git add prodex.json", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"initial\"", { cwd: root, stdio: "ignore" });

		// No changes yet
		const noChanges = await runProdexCommand(["node", "prodex", "git"], root);
		assert.equal(noChanges.ok, false);
		assert.match(noChanges.runs[0].errors.join("\n"), /No Git working-state files matched/);

		// 1. Untracked file
		writeFile(path.join(root, "src/untracked.ts"), "const untracked = true;");

		const untrackedOnly = await runProdexCommand(["node", "prodex", "git", "--untracked", "--dry-run"], root);
		assert.equal(untrackedOnly.ok, true);
		assert.equal(untrackedOnly.runs[0].files.length, 1);
		assert.match(untrackedOnly.runs[0].files[0], /untracked\.ts$/);

		// 2. Staged tracked file
		execSync("git add src/untracked.ts", { cwd: root, stdio: "ignore" }); // now it is staged

		const stagedOnly = await runProdexCommand(["node", "prodex", "git", "--staged", "--dry-run"], root);
		assert.equal(stagedOnly.ok, true);
		assert.equal(stagedOnly.runs[0].files.length, 1);
		assert.match(stagedOnly.runs[0].files[0], /untracked\.ts$/);

		// 3. Unstaged tracked file
		writeFile(path.join(root, "src/untracked.ts"), "const unstaged = true;"); // modified, now staged & unstaged

		const unstagedOnly = await runProdexCommand(["node", "prodex", "git", "--unstaged", "--dry-run"], root);
		assert.equal(unstagedOnly.ok, true);
		assert.equal(unstagedOnly.runs[0].files.length, 1);
		assert.match(unstagedOnly.runs[0].files[0], /untracked\.ts$/);

		// Staged + Untracked
		writeFile(path.join(root, "src/new-untracked.ts"), "const fresh = true;");
		const stagedAndUntracked = await runProdexCommand(["node", "prodex", "git", "--staged", "--untracked", "--dry-run"], root);
		assert.equal(stagedAndUntracked.ok, true);
		assert.equal(stagedAndUntracked.runs[0].files.length, 2);

		// Exclude wins over include
		const exclWins = await runProdexCommand(["node", "prodex", "git", "--changed", "--include", "src/untracked.ts", "--exclude", "src/untracked.ts", "--dry-run"], root);
		assert.equal(exclWins.ok, true);
		assert.equal(exclWins.runs[0].files.length, 1); // only new-untracked.ts remains

		// Deleted file
		execSync("git commit -m \"initial\"", { cwd: root, stdio: "ignore" });
		fs.rmSync(path.join(root, "src/untracked.ts")); // deleted tracked file
		fs.rmSync(path.join(root, "src/new-untracked.ts"), { force: true }); // remove untracked file so only deleted files remain

		const deletedResult = await runProdexCommand(["node", "prodex", "git", "--changed", "--format", "md"], root);
		assert.equal(deletedResult.ok, true);
		const content = fs.readFileSync(deletedResult.runs[0].outputPath, "utf8");
		// should contain Deleted: src/untracked.ts inside metadata summary
		assert.match(content, /Deleted: src\/untracked\.ts/);
		// should NOT have it in files list count
		assert.match(content, /<!-- PRODEX_FILE_COUNT: 0 -->/);

		// Rename scenario
		writeFile(path.join(root, "src/move-me.ts"), "console.log('move me');");
		execSync("git add src/move-me.ts", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"add move-me\"", { cwd: root, stdio: "ignore" });
		execSync("git mv src/move-me.ts src/moved.ts", { cwd: root, stdio: "ignore" });

		const renameResult = await runProdexCommand(["node", "prodex", "git", "--changed", "--format", "md"], root);
		assert.equal(renameResult.ok, true);
		const renameContent = fs.readFileSync(renameResult.runs[0].outputPath, "utf8");

		// Asserts
		// 1. The new path (src/moved.ts) is in the snapshotted files list
		assert.match(renameContent, /File: src\/moved\.ts/);
		// 2. The old path (src/move-me.ts) is NOT in the snapshotted files list
		assert.doesNotMatch(renameContent, /File: src\/move-me\.ts/);
		// 3. The metadata summary shows Renamed: src/move-me.ts -> src/moved.ts
		assert.match(renameContent, /Renamed: src\/move-me\.ts -> src\/moved\.ts/);
	});
});

test("Artifact rendering: metadata sections first, navigation, counters", async () => {
	await usingTempProjectAsync(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig());
		execSync("git add prodex.json", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"initial\"", { cwd: root, stdio: "ignore" });

		writeFile(path.join(root, "src/a.ts"), "const a = 1;");
		writeFile(path.join(root, "src/b.ts"), "const b = 2;");
		execSync("git add src/a.ts src/b.ts", { cwd: root, stdio: "ignore" });

		// Default output: md
		const result = await runProdexCommand(
			["node", "prodex", "git", "--cmd", "node -e \"console.log('attached')\"", "--format", "md"],
			root
		);

		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");

		// Header markers
		assert.match(content, /<!-- PRODEX_SECTION_COUNT: 3 -->/);
		assert.match(content, /<!-- PRODEX_FILE_COUNT: 2 -->/);
		assert.match(content, /<!-- PRODEX_COMMAND_OUTPUT_COUNT: 1 -->/);

		// Order check: Metadata Sections before Files before Command Outputs in index
		const listStartIdx = content.indexOf("<!-- PRODEX_INDEX_LIST_START -->");
		const listEndIdx = content.indexOf("<!-- PRODEX_INDEX_LIST_END -->");
		const indexBlock = content.slice(listStartIdx, listEndIdx);

		const idxStatus = indexBlock.indexOf("Git Status");
		const idxFiles = indexBlock.indexOf("## Files");
		const idxCmds = indexBlock.indexOf("## Command Outputs");

		assert.ok(idxStatus < idxFiles, "Expected Metadata sections to appear before Files in TOC");
		assert.ok(idxFiles < idxCmds, "Expected Files to appear before Command Outputs in TOC");

		// Body order check: Sections before File Snapshots before Command Outputs
		const bodyStatus = content.indexOf("## Git Status");
		const bodyA = content.indexOf("#### 1");
		const bodyCmd = content.indexOf("\n# Command Outputs");

		assert.ok(bodyStatus < bodyA, "Expected Git Status section before File Snapshot 1 in body");
		assert.ok(bodyA < bodyCmd, "Expected File Snapshot 1 before Command Outputs in body");

		// Navigation flows correctly
		// Section 1 navigation next points to sec-2
		assert.match(content, /\[Next\]\(#sec-2\)/);

		// Section 3 (Git Cached Diff Stat, last section) next points to first file (#1)
		assert.match(content, /<a id="sec-3"><\/a>\s*\n## Git Cached Diff Stat\s*\n\[Previous\]\(#sec-2\) \| \[Back to top\]\(#index\) \| \[Next\]\(#1\)/);

		// File 2 (last file) navigation next points to cmd-1
		assert.match(content, /\[Previous\]\(#1\) \| \[Back to top\]\(#index\) \| \[Next\]\(#cmd-1\)/);

		// Command 1 navigation previous points to last file #2
		assert.match(content, /\[Previous\]\(#2\) \| \[Back to top\]\(#index\)/);

		// Non-overlapping range checks
		const lines = content.split("\n");
		const listRangeMatch = content.match(/<!-- PRODEX_INDEX_RANGE: L(\d+)-L(\d+) -->/);
		assert.ok(listRangeMatch);

		const ranges = [];
		const indexLines = lines.slice(
			lines.findIndex(l => l.includes("<!-- PRODEX_INDEX_LIST_START -->")) + 1,
			lines.findIndex(l => l.includes("<!-- PRODEX_INDEX_LIST_END -->"))
		);
		for (const line of indexLines) {
			const m = line.match(/L(\d+)-L(\d+)/);
			if (m) {
				ranges.push({ start: parseInt(m[1], 10), end: parseInt(m[2], 10) });
			}
		}

		// Total sections (3) + Files (2) + Commands (1) = 6 ranges
		assert.equal(ranges.length, 6);
		for (let idx = 0; idx < ranges.length - 1; idx++) {
			assert.ok(ranges[idx].end < ranges[idx + 1].start, `Overlap between index ${idx} and ${idx+1}`);
		}

		// Validate diff includes/excludes
		assert.doesNotMatch(content, /Full Diff/); // not in default diff
	});
});

test("Artifact rendering: --include-diff adds diff sections", async () => {
	await usingTempProjectAsync(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig());
		execSync("git add prodex.json", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"initial\"", { cwd: root, stdio: "ignore" });

		writeFile(path.join(root, "src/a.ts"), "const a = 1;");
		execSync("git add src/a.ts", { cwd: root, stdio: "ignore" });

		const result = await runProdexCommand(
			["node", "prodex", "git", "--changed", "--include-diff", "--format", "md"],
			root
		);

		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");

		// Header markers should have 4 sections now (omitting placeholder File Notes and Full Diff)
		assert.match(content, /<!-- PRODEX_SECTION_COUNT: 4 -->/);
		assert.doesNotMatch(content, /## Full Diff/);
		assert.match(content, /## Cached Full Diff/);
	});
});

test("Command attachment & dry-run: failed commands, dry-run checks", async () => {
	await usingTempProjectAsync(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig());
		execSync("git add prodex.json", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"initial\"", { cwd: root, stdio: "ignore" });

		writeFile(path.join(root, "src/a.ts"), "const a = 1;");
		execSync("git add src/a.ts", { cwd: root, stdio: "ignore" });

		// Dry run: does not execute commands
		const resultDry = await runProdexCommand(
			["node", "prodex", "git", "--cmd", "node -e \"process.exit(1)\"", "--dry-run"],
			root
		);
		assert.equal(resultDry.ok, true);
		assert.equal(resultDry.runs[0].outputPath, undefined);
		assert.deepEqual(resultDry.runs[0].plannedCommands, ["node -e \"process.exit(1)\""]);

		// Fail on cmd error fails command result
		const resultFail = await runProdexCommand(
			["node", "prodex", "git", "--cmd", "node -e \"process.exit(55)\"", "--fail-on-cmd-error", "--format", "txt"],
			root
		);
		assert.equal(resultFail.ok, false);
		assert.equal(resultFail.exitCode, 1);
		assert.ok(resultFail.runs[0].outputPath);
		const content = fs.readFileSync(resultFail.runs[0].outputPath, "utf8");
		assert.match(content, /Exit Code: 55/);
	});
});

test("Git output truncation on ENOBUFS", async () => {
	const { runGit } = require("../dist/app/git-source-provider.js");
	await usingTempProjectAsync(async (root) => {
		initGitRepo(root);
		const warnings = [];
		const errors = [];
		// Run status with tiny maxBuffer to trigger ENOBUFS
		const output = runGit(["status"], root, warnings, errors, 2);
		assert.equal(errors.length, 0);
		assert.equal(warnings.length, 1);
		assert.match(warnings[0], /exceeded limit and was truncated/i);
		assert.ok(output.length <= 2);
	});
});

test("Markdown renderer uses dynamic fences for generic sections", () => {
	const { renderTraceMd } = require("../dist/output/markdown.js");
	const payload = {
		root: "/root",
		files: [],
		sections: [
			{
				id: "custom-sec",
				title: "Custom Section",
				kind: "code",
				language: "md",
				content: "```js\nconsole.log('hello');\n```"
			}
		]
	};
	const { content } = renderTraceMd(payload);
	// It should use 4 backticks because the content contains 3 backticks
	assert.match(content, /````md\n```js/);
	assert.match(content, /```\n````/);
});

test("Omission of empty and placeholder-only sections", async () => {
	await usingTempProjectAsync(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig());
		execSync("git add prodex.json", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"initial\"", { cwd: root, stdio: "ignore" });

		// Add a committed file and delete it to get actual File Notes
		writeFile(path.join(root, "src/deleted.ts"), "console.log('deleted');");
		execSync("git add src/deleted.ts", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"add deleted\"", { cwd: root, stdio: "ignore" });
		fs.rmSync(path.join(root, "src/deleted.ts"));

		// Also add an unstaged modification so we have a full diff
		writeFile(path.join(root, "src/unstaged.ts"), "console.log('unstaged');");
		execSync("git add src/unstaged.ts", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"add unstaged\"", { cwd: root, stdio: "ignore" });
		writeFile(path.join(root, "src/unstaged.ts"), "console.log('unstaged modified');");

		// No cached changes exist.
		// That means:
		// - Git Status: M src/unstaged.ts, D src/deleted.ts (real, kept)
		// - Git Diff Stat: diff stat of unstaged.ts (real, kept)
		// - Git Cached Diff Stat: '(no cached diff stat)' (omitted)
		// - File Notes: '- Deleted: src/deleted.ts' (real, kept!)
		// - Full Diff: diff of unstaged.ts (real, kept)
		// - Cached Full Diff: '(no changes)' (omitted)
		//
		// We expect 4 sections: Git Status, Git Diff Stat, File Notes, Full Diff

		const result = await runProdexCommand(
			["node", "prodex", "git", "--changed", "--include-diff", "--cmd", "node -e \"\"", "--format", "md"],
			root
		);

		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");

		assert.match(content, /<!-- PRODEX_SECTION_COUNT: 4 -->/);

		// The omitted section titles should not be present in the index
		assert.doesNotMatch(content, /- \[Git Cached Diff Stat\]/);
		assert.doesNotMatch(content, /- \[Cached Full Diff\]/);

		// The omitted section titles should not be present in the body headers
		assert.doesNotMatch(content, /## Git Cached Diff Stat/);
		assert.doesNotMatch(content, /## Cached Full Diff/);

		// The anchors for omitted sections should not be generated (e.g. sec-5, sec-6 should not exist)
		assert.doesNotMatch(content, /id="sec-5"/);
		assert.doesNotMatch(content, /id="sec-6"/);

		// File Notes is kept and contains Deleted: src/deleted.ts
		assert.match(content, /Deleted: src\/deleted\.ts/);

		// Navigation check:
		// Emitted sections: sec-1 (Git Status), sec-2 (Git Diff Stat), sec-3 (File Notes), sec-4 (Full Diff)
		// sec-4 (Full Diff) next should point to #1 (unstaged.ts) because it's the last section.
		// It should not point to sec-5 or sec-6.
		assert.match(content, /<a id="sec-4"><\/a>\s*\n## Full Diff\s*\n\[Previous\]\(#sec-3\) \| \[Back to top\]\(#index\) \| \[Next\]\(#1\)/);

		// File 1 next should point to cmd-1
		assert.match(content, /\` File: src\/unstaged\.ts \`\s*\[Previous\]\(#sec-4\) \| \[Back to top\]\(#index\) \| \[Next\]\(#cmd-1\)/);

		// Non-overlapping range checks should be correct (only 4 sections + 1 file + 1 command = 6 ranges)
		const lines = content.split("\n");
		const ranges = [];
		const listStartIdx = lines.findIndex(l => l.includes("<!-- PRODEX_INDEX_LIST_START -->"));
		const listEndIdx = lines.findIndex(l => l.includes("<!-- PRODEX_INDEX_LIST_END -->"));
		const indexLines = lines.slice(listStartIdx + 1, listEndIdx);
		for (const line of indexLines) {
			const m = line.match(/L(\d+)-L(\d+)/);
			if (m) {
				ranges.push({ start: parseInt(m[1], 10), end: parseInt(m[2], 10) });
			}
		}
		assert.equal(ranges.length, 6);
		for (let idx = 0; idx < ranges.length - 1; idx++) {
			assert.ok(ranges[idx].end < ranges[idx + 1].start, `Overlap between index ${idx} and ${idx+1}`);
		}

		// Command Output (even with empty stdout/stderr) is preserved.
		assert.match(content, /<!-- PRODEX_COMMAND_OUTPUT_COUNT: 1 -->/);
		assert.match(content, /## Command 1: node -e ""/);
	});
});

test("Preservation of real sections", async () => {
	await usingTempProjectAsync(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig());
		execSync("git add prodex.json", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"initial\"", { cwd: root, stdio: "ignore" });

		// 1. Stage a modification so Git Cached Diff Stat and Cached Full Diff have actual content.
		writeFile(path.join(root, "src/staged.ts"), "console.log('staged');");
		execSync("git add src/staged.ts", { cwd: root, stdio: "ignore" });

		// We have staged changes but no unstaged changes.
		// That means:
		// - Git Status: real
		// - Git Diff Stat: '(no diff stat)' (which is NOT in our filter list, so it will be kept)
		// - Git Cached Diff Stat: real (kept)
		// - File Notes: '(none)' (filtered out)
		// - Full Diff: '(no changes)' (filtered out)
		// - Cached Full Diff: real (kept)
		//
		// Sections expected: Git Status, Git Diff Stat, Git Cached Diff Stat, Cached Full Diff
		// (File Notes and Full Diff are omitted because they are placeholder-only)

		const result = await runProdexCommand(
			["node", "prodex", "git", "--staged", "--include-diff", "--format", "md"],
			root
		);

		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");

		// Full Diff and File Notes should be omitted.
		assert.doesNotMatch(content, /## Full Diff/);
		assert.doesNotMatch(content, /- \[Full Diff\]/);
		assert.doesNotMatch(content, /## File Notes/);
		assert.doesNotMatch(content, /- \[File Notes\]/);

		// Git Cached Diff Stat and Cached Full Diff should be preserved.
		assert.match(content, /## Git Cached Diff Stat/);
		assert.match(content, /## Cached Full Diff/);
		assert.match(content, /- \[Git Cached Diff Stat\]/);
		assert.match(content, /- \[Cached Full Diff\]/);
		// Total sections should be 4 (out of 6 potential ones, omitting File Notes and Full Diff)
		assert.match(content, /<!-- PRODEX_SECTION_COUNT: 4 -->/);
	});
});

test("Git historical modes: commit mode snapshots content from commit, handles deleted, renamed, binary, include/exclude", async () => {
	await usingTempProjectAsync(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig());
		execSync("git add prodex.json", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"initial\"", { cwd: root, stdio: "ignore" });

		// 1. Add some files and commit them
		writeFile(path.join(root, "src/file1.ts"), "const original = 1;");
		writeFile(path.join(root, "src/file-binary.png"), "binary content \0 hello"); // contains NUL byte, so binary
		writeFile(path.join(root, "src/file-delete.ts"), "will be deleted");
		execSync("git add src/file1.ts src/file-binary.png src/file-delete.ts", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"add files\"", { cwd: root, stdio: "ignore" });

		// Save the revision
		const rev = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();

		// 2. Modify files on disk to confirm we snapshot from commit, not working tree
		writeFile(path.join(root, "src/file1.ts"), "const modified = 999;");
		fs.rmSync(path.join(root, "src/file-delete.ts")); // delete on disk
		writeFile(path.join(root, "src/file-new.ts"), "not in that commit");

		// Run prodex git --commit <rev>
		const result = await runProdexCommand(["node", "prodex", "git", "--commit", rev, "--format", "md"], root);
		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");

		// File count should be 2 because file-binary is binary and file-delete is present in this rev
		assert.match(content, /<!-- PRODEX_FILE_COUNT: 2 -->/);
		// Check that file1.ts contains original content, not modified content
		assert.match(content, /const original = 1;/);
		assert.doesNotMatch(content, /const modified = 999;/);

		// Binary and Deleted check
		assert.match(content, /Binary: src\/file-binary\.png/);
		assert.doesNotMatch(content, /Deleted: src\/file-delete\.ts/); // because it was present in that rev!

		// Exclude check
		const resultExcl = await runProdexCommand(["node", "prodex", "git", "--commit", rev, "--exclude", "src/file1.ts", "--format", "md"], root);
		assert.equal(resultExcl.ok, true);
		const contentExcl = fs.readFileSync(resultExcl.runs[0].outputPath, "utf8");
		assert.match(contentExcl, /<!-- PRODEX_FILE_COUNT: 1 -->/);

		// Include check
		writeFile(path.join(root, "src/file-extra.ts"), "extra content");
		const resultIncl = await runProdexCommand(["node", "prodex", "git", "--commit", rev, "--include", "src/file-extra.ts", "--format", "md"], root);
		assert.equal(resultIncl.ok, true);
		const contentIncl = fs.readFileSync(resultIncl.runs[0].outputPath, "utf8");
		assert.match(contentIncl, /<!-- PRODEX_FILE_COUNT: 3 -->/);
		assert.match(contentIncl, /extra content/);

		// Include diff checks
		const resultDiff = await runProdexCommand(["node", "prodex", "git", "--commit", rev, "--include-diff", "--format", "md"], root);
		assert.equal(resultDiff.ok, true);
		const contentDiff = fs.readFileSync(resultDiff.runs[0].outputPath, "utf8");
		assert.match(contentDiff, /## Commit Diff/);
		assert.match(contentDiff, /add files/);
	});
});

test("Git historical modes: range mode snapshots content from head of range, supports warning and diff", async () => {
	await usingTempProjectAsync(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig());
		execSync("git add prodex.json", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"initial\"", { cwd: root, stdio: "ignore" });

		const baseRev = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();

		// Add first commit
		writeFile(path.join(root, "src/file1.ts"), "v1");
		execSync("git add src/file1.ts", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"commit 1\"", { cwd: root, stdio: "ignore" });

		// Add second commit (modifies file1.ts)
		writeFile(path.join(root, "src/file1.ts"), "v2");
		execSync("git add src/file1.ts", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"commit 2\"", { cwd: root, stdio: "ignore" });

		const headRev = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();

		// Modify file1.ts on disk to confirm we snapshot from headRev
		writeFile(path.join(root, "src/file1.ts"), "disk-version");

		// Run range mode
		const result = await runProdexCommand(["node", "prodex", "git", "--range", `${baseRev}..${headRev}`, "--format", "md"], root);
		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");

		// Should show v2, not disk-version
		assert.match(content, /v2/);
		assert.doesNotMatch(content, /disk-version/);

		// Warning check for three-dot range
		const result3dot = await runProdexCommand(["node", "prodex", "git", "--range", `${baseRev}...${headRev}`, "--format", "md"], root);
		assert.equal(result3dot.ok, true);
		assert.match(result3dot.runs[0].warnings.join("\n"), /Using three-dot range/);
	});
});

test("Git historical modes: against mode compares merge-base against HEAD, snapshots from HEAD", async () => {
	await usingTempProjectAsync(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig());
		execSync("git add prodex.json", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"initial\"", { cwd: root, stdio: "ignore" });

		// Rename current branch to main
		execSync("git branch -m main", { cwd: root, stdio: "ignore" });

		// We are on main branch. Let's create a feature branch
		execSync("git checkout -b feature", { cwd: root, stdio: "ignore" });

		// Write a file in feature branch and commit
		writeFile(path.join(root, "src/feature.ts"), "feature branch code");
		execSync("git add src/feature.ts", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"feature commit\"", { cwd: root, stdio: "ignore" });

		// Go back to main, write another file and commit
		execSync("git checkout main", { cwd: root, stdio: "ignore" });
		writeFile(path.join(root, "src/main-only.ts"), "main code");
		execSync("git add src/main-only.ts", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"main commit\"", { cwd: root, stdio: "ignore" });

		// Go back to feature
		execSync("git checkout feature", { cwd: root, stdio: "ignore" });

		// Modify feature.ts on disk to verify snapshot comes from HEAD revision
		writeFile(path.join(root, "src/feature.ts"), "modified on disk");

		// Run against main mode
		const result = await runProdexCommand(["node", "prodex", "git", "--against", "main", "--format", "md"], root);
		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");

		// File count should be 1 (src/feature.ts). main-only.ts should not be there because we are against main!
		assert.match(content, /<!-- PRODEX_FILE_COUNT: 1 -->/);
		assert.match(content, /feature branch code/);
		assert.doesNotMatch(content, /modified on disk/);
		assert.doesNotMatch(content, /main-only\.ts/);
	});
});

test("Git historical modes: commit mode records deleted files as notes only", async () => {
	await usingTempProjectAsync(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig());
		execSync("git add prodex.json", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"initial\"", { cwd: root, stdio: "ignore" });

		// 1. Create and commit src/delete-me.ts
		writeFile(path.join(root, "src/delete-me.ts"), "will be deleted");
		execSync("git add src/delete-me.ts", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"add delete-me\"", { cwd: root, stdio: "ignore" });

		// 2. Delete src/delete-me.ts
		fs.rmSync(path.join(root, "src/delete-me.ts"));

		// 3. Commit the deletion
		execSync("git add src/delete-me.ts", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"delete delete-me\"", { cwd: root, stdio: "ignore" });

		const deleteCommit = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();

		// 4. Run prodex git --commit <deleteCommit> --format md
		const result = await runProdexCommand(["node", "prodex", "git", "--commit", deleteCommit, "--format", "md"], root);
		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");

		// 5. Assert File Notes contains: Deleted: src/delete-me.ts
		assert.match(content, /Deleted: src\/delete-me\.ts/);

		// 6. Assert the artifact does not include a file section for src/delete-me.ts
		assert.doesNotMatch(content, /File: src\/delete-me\.ts/);

		// 7. Assert the file count does not include delete-me.ts
		assert.match(content, /<!-- PRODEX_FILE_COUNT: 0 -->/);
	});
});

test("Git historical modes: commit mode records renamed files and snapshots the new path", async () => {
	await usingTempProjectAsync(async (root) => {
		initGitRepo(root);
		writeJson(path.join(root, "prodex.json"), baseConfig());
		execSync("git add prodex.json", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"initial\"", { cwd: root, stdio: "ignore" });

		// 1. Create and commit src/old-name.ts
		writeFile(path.join(root, "src/old-name.ts"), "const renamed = true;");
		execSync("git add src/old-name.ts", { cwd: root, stdio: "ignore" });
		execSync("git commit -m \"add old-name\"", { cwd: root, stdio: "ignore" });

		// 2. git mv src/old-name.ts src/new-name.ts
		execSync("git mv src/old-name.ts src/new-name.ts", { cwd: root, stdio: "ignore" });

		// 3. Commit the rename
		execSync("git commit -m \"rename to new-name\"", { cwd: root, stdio: "ignore" });

		const renameCommit = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();

		// 4. Run prodex git --commit <renameCommit> --format md
		const result = await runProdexCommand(["node", "prodex", "git", "--commit", renameCommit, "--format", "md"], root);
		assert.equal(result.ok, true);
		const content = fs.readFileSync(result.runs[0].outputPath, "utf8");

		// 5. Assert File Notes contains: Renamed: src/old-name.ts -> src/new-name.ts
		assert.match(content, /Renamed: src\/old-name\.ts -> src\/new-name\.ts/);

		// 6. Assert the artifact includes File: src/new-name.ts
		assert.match(content, /File: src\/new-name\.ts/);

		// 7. Assert the artifact does not include File: src/old-name.ts
		assert.doesNotMatch(content, /File: src\/old-name\.ts/);
		assert.match(content, /const renamed = true;/);
	});
});
