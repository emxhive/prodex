const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveClipboardCandidates, copyFileToClipboard } = require("../dist/clipboard/clipboard.js");

test("resolveClipboardCandidates - darwin returns null", () => {
	const candidates = resolveClipboardCandidates("/path/to/file.md", "darwin", {});
	assert.equal(candidates, null);
});

test("resolveClipboardCandidates - win32 returns powershell with Set-Clipboard -LiteralPath", () => {
	const candidates = resolveClipboardCandidates("C:\\path\\to\\file.md", "win32", {});
	assert.equal(candidates.length, 1);
	assert.equal(candidates[0].bin, "powershell.exe");
	assert.deepEqual(candidates[0].args, [
		"-NoProfile",
		"-NonInteractive",
		"-Command",
		"& { Set-Clipboard -LiteralPath $args[0] }",
		"C:\\path\\to\\file.md"
	]);
});

test("resolveClipboardCandidates - complex paths containing spaces, brackets, parentheses, and quotes on win32", () => {
	const complexPath = "C:\\path\\to\\my folder\\file's [test] (version 1).md";
	
	const win32Candidates = resolveClipboardCandidates(complexPath, "win32", {});
	assert.equal(win32Candidates[0].args[win32Candidates[0].args.length - 1], complexPath);
});

test("resolveClipboardCandidates - linux returns null", () => {
	const candidates = resolveClipboardCandidates("/path/to/file.md", "linux", {});
	assert.equal(candidates, null);
});

test("resolveClipboardCandidates - unsupported platform returns null", () => {
	const candidates = resolveClipboardCandidates("/path/to/file.md", "freebsd", {});
	assert.equal(candidates, null);
});

test("copyFileToClipboard - validates that the file must exist", async () => {
	const res = await copyFileToClipboard("nonexistent_file_xyz.txt", { platform: "win32" });
	assert.equal(res.ok, false);
	assert.match(res.warning, /target file does not exist/);
});

test("copyFileToClipboard - falls back if candidate fails on win32", async () => {
	const platform = "win32";
	const env = {};
	const calls = [];

	const mockSpawn = (bin, args) => {
		calls.push({ bin, args });
		const mockChild = {
			pid: 999,
			killed: false,
			kill: () => {
				mockChild.killed = true;
			},
			on: (event, cb) => {
				if (event === "close") {
					// Exit with 1 (fail)
					process.nextTick(() => cb(1));
				}
			}
		};
		return mockChild;
	};

	const res = await copyFileToClipboard(__filename, { platform, env, spawn: mockSpawn });
	assert.equal(res.ok, false);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].bin, "powershell.exe");
	assert.match(res.warning, /clipboard write failed/);
});

test("copyFileToClipboard - successful run has no cleanup or kill on win32", async () => {
	let cleanupTriggeredKill = false;

	const mockSpawnSuccess = (bin, args) => {
		const mockChild = {
			pid: 123,
			killed: false,
			kill: () => {
				cleanupTriggeredKill = true;
			},
			on: (event, cb) => {
				if (event === "close") {
					process.nextTick(() => cb(0));
				}
			}
		};
		return mockChild;
	};

	const successRes = await copyFileToClipboard(__filename, { platform: "win32", env: {}, spawn: mockSpawnSuccess });
	assert.equal(successRes.ok, true);
	assert.equal(cleanupTriggeredKill, false);
});

test("copyFileToClipboard - error path triggers cleanup on win32", async () => {
	let cleanupTriggeredKill = false;

	const mockSpawnError = (bin, args) => {
		const mockChild = {
			pid: 123,
			killed: false,
			kill: () => {
				cleanupTriggeredKill = true;
			},
			on: (event, cb) => {
				if (event === "error") {
					process.nextTick(() => cb(new Error("spawn failed")));
				}
			}
		};
		return mockChild;
	};

	const res = await copyFileToClipboard(__filename, { platform: "win32", env: {}, spawn: mockSpawnError });
	assert.equal(res.ok, false);
	assert.equal(cleanupTriggeredKill, true);
});

test("copyFileToClipboard - darwin returns unsupported warning directly", async () => {
	const res = await copyFileToClipboard(__filename, { platform: "darwin" });
	assert.equal(res.ok, false);
	assert.equal(res.warning, "file clipboard copy is not supported on this platform yet");
});

test("copyFileToClipboard - linux returns unsupported warning directly", async () => {
	const res = await copyFileToClipboard(__filename, { platform: "linux" });
	assert.equal(res.ok, false);
	assert.equal(res.warning, "file clipboard copy is not supported on this platform yet");
});
