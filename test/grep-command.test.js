const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { runProdexCommand } = require("../dist/index.js");

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
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-grep-test-"));
	try {
		return await fn(root);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

test("grep command is recognized and help topic works", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		const helpRes = await runProdexCommand(["node", "prodex", "grep", "--help"], root);
		assert.equal(helpRes.ok, true);
		assert.match(helpRes.message, /Usage:\s+prodex grep/);
	});
});

test("validation: no search mode fails", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		const res = await runProdexCommand(["node", "prodex", "grep"], root);
		assert.equal(res.ok, false);
		assert.match(res.errors.join("\n"), /requires one search mode/);
	});
});

test("validation: multiple positive search modes fail", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		const res = await runProdexCommand(["node", "prodex", "grep", "-q", "foo", "-r", "bar"], root);
		assert.equal(res.ok, false);
		assert.match(res.errors.join("\n"), /accepts only one positive search mode/);
	});
});

test("validation: blank query/terms fail", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		
		const res1 = await runProdexCommand(["node", "prodex", "grep", "-q", "  "], root);
		assert.equal(res1.ok, false);
		assert.match(res1.errors.join("\n"), /Search terms cannot be blank/);

		const res2 = await runProdexCommand(["node", "prodex", "grep", "--any", ""], root);
		assert.equal(res2.ok, false);
		assert.match(res2.errors.join("\n"), /Search terms cannot be blank/);

		const res3 = await runProdexCommand(["node", "prodex", "grep", "-q", "foo", "--not", ""], root);
		assert.equal(res3.ok, false);
		assert.match(res3.errors.join("\n"), /Search terms cannot be blank/);
	});
});

test("validation: invalid max-files fails", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		const res = await runProdexCommand(["node", "prodex", "grep", "-q", "foo", "--max-files", "-1"], root);
		assert.equal(res.ok, false);
		assert.match(res.errors.join("\n"), /--max-files must be an integer greater than 0/);
	});
});

test("search mode: --query fixed-string search works", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/foo.txt"), "hello world. test query string here.");
		writeFile(path.join(root, "src/bar.txt"), "no matches here.");

		const res = await runProdexCommand(["node", "prodex", "grep", "-q", "test query", "--dry-run"], root);
		assert.equal(res.ok, true);
		assert.equal(res.runs[0].files.length, 1);
		assert.match(res.runs[0].files[0], /foo\.txt$/);
	});
});

test("search mode: --any OR search works", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/foo.txt"), "apple pie");
		writeFile(path.join(root, "src/bar.txt"), "banana split");
		writeFile(path.join(root, "src/baz.txt"), "cherry pie");

		const res = await runProdexCommand(["node", "prodex", "grep", "--any", "apple,banana", "--dry-run"], root);
		assert.equal(res.ok, true);
		assert.equal(res.runs[0].files.length, 2);
		const relativePaths = res.runs[0].files.map(f => path.basename(f)).sort();
		assert.deepEqual(relativePaths, ["bar.txt", "foo.txt"]);
	});
});

test("search mode: --all AND search works", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/foo.txt"), "ExecutionPlan contains gitOptions and traceOptions.");
		writeFile(path.join(root, "src/bar.txt"), "ExecutionPlan contains gitOptions.");

		const res = await runProdexCommand(["node", "prodex", "grep", "--all", "ExecutionPlan,gitOptions,traceOptions", "--dry-run"], root);
		assert.equal(res.ok, true);
		assert.equal(res.runs[0].files.length, 1);
		assert.match(res.runs[0].files[0], /foo\.txt$/);
	});
});

test("search mode: --regex regex search works", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/foo.txt"), "createExecutionPlans is here");
		writeFile(path.join(root, "src/bar.txt"), "createExecutionPlan here");

		const res = await runProdexCommand(["node", "prodex", "grep", "-r", "createExecutionPlan[a-z]+", "--dry-run"], root);
		assert.equal(res.ok, true);
		assert.equal(res.runs[0].files.length, 1);
		assert.match(res.runs[0].files[0], /foo\.txt$/);
	});
});

test("invalid regex fails clearly", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		const res = await runProdexCommand(["node", "prodex", "grep", "-r", "build[A-Z("], root);
		assert.equal(res.ok, false);
		assert.ok(res.runs[0].errors.length > 0);
	});
});

test("negative content filter: --not works", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/foo.txt"), "ExecutionPlan is important");
		writeFile(path.join(root, "src/bar.txt"), "ExecutionPlan is legacy");

		const res = await runProdexCommand(["node", "prodex", "grep", "-q", "ExecutionPlan", "--not", "legacy,deprecated", "--dry-run"], root);
		assert.equal(res.ok, true);
		assert.equal(res.runs[0].files.length, 1);
		assert.match(res.runs[0].files[0], /foo\.txt$/);
	});
});

test("path boundary filter: --within works", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/foo.txt"), "test matched query");
		writeFile(path.join(root, "tests/bar.txt"), "test matched query");

		const res = await runProdexCommand(["node", "prodex", "grep", "-q", "test matched", "--within", "src", "--dry-run"], root);
		assert.equal(res.ok, true);
		assert.equal(res.runs[0].files.length, 1);
		assert.match(res.runs[0].files[0], /foo\.txt$/);
	});
});

test("path boundary exclusion: --skip works", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/foo.txt"), "test matched query");
		writeFile(path.join(root, "src/skipdir/bar.txt"), "test matched query");

		const res = await runProdexCommand(["node", "prodex", "grep", "-q", "test matched", "--skip", "src/skipdir", "--dry-run"], root);
		assert.equal(res.ok, true);
		assert.equal(res.runs[0].files.length, 1);
		assert.match(res.runs[0].files[0], /foo\.txt$/);
	});
});

test("--include and --exclude work, with excludes winning and max-files applying before includes", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/foo.txt"), "matched query");
		writeFile(path.join(root, "src/bar.txt"), "matched query");
		writeFile(path.join(root, "src/baz.txt"), "matched query");
		writeFile(path.join(root, "README.md"), "include me directly");

		// Live execution writes artifact
		const res = await runProdexCommand([
			"node", "prodex", "grep", 
			"-q", "matched query", 
			"--max-files", "2", 
			"--include", "README.md", 
			"--exclude", "src/bar.txt",
			"-n", "grep-exclude-test",
			"--format", "txt"
		], root);

		assert.equal(res.ok, true);
		const relativePaths = res.runs[0].files.map(f => path.basename(f)).sort();
		assert.deepEqual(relativePaths, ["README.md", "baz.txt"]);

		const outputPath = res.runs[0].outputPath;
		assert.ok(fs.existsSync(outputPath));
		const content = fs.readFileSync(outputPath, "utf8");

		// Excluded matched file must not appear in the matches section
		assert.doesNotMatch(content, /bar\.txt/);
		// Remaining matched file should show up with correct matching line wording
		assert.match(content, /baz\.txt \(1 matching line\)/);
	});
});

test("missing ripgrep behavior is handled", async () => {
	const cp = require("child_process");
	const originalSpawnSync = cp.spawnSync;
	cp.spawnSync = (cmd, args, opts) => {
		if (cmd === "rg") {
			return { error: { code: "ENOENT" } };
		}
		return originalSpawnSync(cmd, args, opts);
	};
	try {
		await usingTempProject(async (root) => {
			writeJson(path.join(root, "prodex.json"), baseConfig());
			const result = await runProdexCommand(["node", "prodex", "grep", "--query", "foo"], root);
			assert.equal(result.ok, false);
			assert.match(result.runs[0].errors.join("\n"), /requires ripgrep/);
		});
	} finally {
		cp.spawnSync = originalSpawnSync;
	}
});

test("no-match behavior handles warnings vs errors", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "README.md"), "directly included file");

		// Case 1: no matched files, no includes -> fails
		const resError = await runProdexCommand(["node", "prodex", "grep", "-q", "nonexistentquery"], root);
		assert.equal(resError.ok, false);
		assert.match(resError.runs[0].errors.join("\n"), /No files matched grep search/);

		// Case 2: no matched files, but includes provided -> succeeds with warning
		const resWarn = await runProdexCommand(["node", "prodex", "grep", "-q", "nonexistentquery", "--include", "README.md", "--dry-run"], root);
		assert.equal(resWarn.ok, true);
		assert.match(resWarn.runs[0].warnings.join("\n"), /No files matched grep search/);
		assert.equal(resWarn.runs[0].files.length, 1);
		assert.match(resWarn.runs[0].files[0], /README\.md$/);
	});
});

test("command attachments work with dry-run and live executions", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig());
		writeFile(path.join(root, "src/foo.txt"), "matched query");

		// Dry-run command attachments are collected but not run
		const resDry = await runProdexCommand([
			"node", "prodex", "grep", 
			"-q", "matched query", 
			"--cmd", "node -e \"console.log('attached command execution')\"", 
			"--dry-run"
		], root);
		assert.equal(resDry.ok, true);
		assert.deepEqual(resDry.runs[0].plannedCommands, ["node -e \"console.log('attached command execution')\""]);

		// Live execution writes artifact and runs command
		const resLive = await runProdexCommand([
			"node", "prodex", "grep", 
			"-q", "matched query", 
			"--cmd", "node -e \"console.log('grep command attached output')\"",
			"-n", "grep-attached",
			"--format", "txt"
		], root);
		assert.equal(resLive.ok, true);
		const outputPath = resLive.runs[0].outputPath;
		assert.ok(fs.existsSync(outputPath));
		const content = fs.readFileSync(outputPath, "utf8");
		assert.match(content, /grep command attached output/);
	});
});

test("Artifact layout policy and navigation flow for file-first vs git commands", async () => {
	await usingTempProject(async (root) => {
		writeJson(path.join(root, "prodex.json"), baseConfig({
			output: { dir: "prodex", versioned: false, format: "md" }
		}));
		writeFile(path.join(root, "src/foo.txt"), "matched query");

		// Run a file-first command: grep, with command output
		const resGrep = await runProdexCommand([
			"node", "prodex", "grep",
			"-q", "matched query",
			"--cmd", "node -e \"console.log('grep command output content')\"",
			"-n", "grep-layout-test",
			"--format", "md"
		], root);

		assert.equal(resGrep.ok, true);
		const mdContent = fs.readFileSync(resGrep.runs[0].outputPath, "utf8");

		// 1. prodex grep Markdown body renders file contents before Grep Summary
		const bodyFile = mdContent.indexOf("#### 1");
		const bodySummary = mdContent.indexOf("## Grep Summary");
		assert.ok(bodyFile > 0 && bodySummary > 0);
		assert.ok(bodyFile < bodySummary, "Expected file contents before Grep Summary in body");

		// 2. prodex grep Markdown body renders command outputs before Grep Summary
		const bodyCmd = mdContent.indexOf("# Command Outputs");
		assert.ok(bodyCmd > 0);
		assert.ok(bodyCmd < bodySummary, "Expected command outputs before Grep Summary in body");

		// 3. prodex grep Markdown/TOC order matches file-first body order
		const listStartIdx = mdContent.indexOf("<!-- PRODEX_INDEX_LIST_START -->");
		const listEndIdx = mdContent.indexOf("<!-- PRODEX_INDEX_LIST_END -->");
		const tocBlock = mdContent.slice(listStartIdx, listEndIdx);

		const tocFiles = tocBlock.indexOf("## Files");
		const tocCmds = tocBlock.indexOf("## Command Outputs");
		const tocSummary = tocBlock.indexOf("## Metadata Sections");
		assert.ok(tocFiles > -1 && tocCmds > -1 && tocSummary > -1);
		assert.ok(tocFiles < tocCmds, "TOC Files should be before Command Outputs");
		assert.ok(tocCmds < tocSummary, "TOC Command Outputs should be before Metadata Sections");

		// 6. Navigation Previous / Next follows the rendered order after reordering
		// File 1 (first item) next points to cmd-1
		assert.match(mdContent, /\[Back to top\]\(#index\) \| \[Next\]\(#cmd-1\)/);
		// Command 1 previous points to 1, next points to sec-1
		assert.match(mdContent, /\[Previous\]\(#1\) \| \[Back to top\]\(#index\) \| \[Next\]\(#sec-1\)/);
		// Section 1 (Grep Summary) previous points to cmd-1, next points to sec-2
		assert.match(mdContent, /\[Previous\]\(#cmd-1\) \| \[Back to top\]\(#index\) \| \[Next\]\(#sec-2\)/);

		// 7. Line-range/index metadata check
		const lines = mdContent.split("\n");
		const ranges = [];
		const lineStartIdx = lines.findIndex(l => l.includes("<!-- PRODEX_INDEX_LIST_START -->"));
		const lineEndIdx = lines.findIndex(l => l.includes("<!-- PRODEX_INDEX_LIST_END -->"));
		for (const line of lines.slice(lineStartIdx + 1, lineEndIdx)) {
			const m = line.match(/L(\d+)-L(\d+)/);
			if (m) {
				ranges.push({ start: parseInt(m[1], 10), end: parseInt(m[2], 10) });
			}
		}
		// 1 file, 1 cmd output, 2 generic sections = 4 ranges
		assert.equal(ranges.length, 4);
		for (let idx = 0; idx < ranges.length - 1; idx++) {
			assert.ok(ranges[idx].end < ranges[idx + 1].start, `Overlap in line range between index ${idx} and ${idx + 1}`);
		}

		// 4. prodex grep TXT output follows the same order
		const resGrepTxt = await runProdexCommand([
			"node", "prodex", "grep",
			"-q", "matched query",
			"--cmd", "node -e \"console.log('grep command output content')\"",
			"-n", "grep-layout-test-txt",
			"--format", "txt"
		], root);

		assert.equal(resGrepTxt.ok, true);
		const txtContent = fs.readFileSync(resGrepTxt.runs[0].outputPath, "utf8");

		const txtFileIndex = txtContent.indexOf("##==== path: ");
		const txtCmdIndex = txtContent.indexOf("##==== Command Attachments ====");
		const txtSummaryIndex = txtContent.indexOf("##==== section: Grep Summary ====");

		assert.ok(txtFileIndex > -1 && txtCmdIndex > -1 && txtSummaryIndex > -1);
		assert.ok(txtFileIndex < txtCmdIndex, "TXT: file should be before command outputs");
		assert.ok(txtCmdIndex < txtSummaryIndex, "TXT: command outputs should be before Grep Summary");

		// TXT TOC ordering check
		const txtTocHeader = txtContent.indexOf("##==== Combined Scope ====");
		const txtTocFile = txtContent.indexOf("## - File: ");
		const txtTocSec = txtContent.indexOf("## - Section: ");
		assert.ok(txtTocHeader > -1 && txtTocFile > -1 && txtTocSec > -1);
		assert.ok(txtTocFile < txtTocSec, "TXT TOC: File should be before Section");
	});
});
