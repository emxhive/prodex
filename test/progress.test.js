const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { ConsoleProgressReporter, NoopProgressReporter } = require("../dist/app/progress.js");
const { runProdexCommand } = require("../dist/index.js");

class MockStream {
	constructor(isTTY = false) {
		this.isTTY = isTTY;
		this.data = [];
	}

	write(chunk) {
		this.data.push(chunk.toString());
		return true;
	}
}

test("ConsoleProgressReporter - non-interactive mode uses persistent lines", () => {
	const stream = new MockStream(false);
	const reporter = new ConsoleProgressReporter({ isInteractive: false, stream });

	reporter.start("loading project");
	reporter.update("planning command");
	reporter.complete("wrote", "prodex@prodex/trace-main.md");

	assert.deepEqual(stream.data, [
		"Prodex: loading project...\n",
		"Prodex: planning command...\n",
		"Prodex: wrote prodex@prodex/trace-main.md\n"
	]);
});

test("ConsoleProgressReporter - interactive mode uses in-place same-line updates", () => {
	const stream = new MockStream(true);
	const reporter = new ConsoleProgressReporter({ isInteractive: true, stream });

	reporter.start("loading project");
	reporter.update("planning command");
	reporter.complete("wrote", "prodex@prodex/trace-main.md");

	const fullOutput = stream.data.join("");
	// Check that ANSI clear / move-to codes and the text exist in the stream
	assert.match(fullOutput, /Prodex: loading project\.\.\./);
	assert.match(fullOutput, /Prodex: planning command\.\.\./);
	assert.match(fullOutput, /Prodex: wrote prodex@prodex\/trace-main\.md\n/);
});

test("ConsoleProgressReporter - complete and warn end with newline", () => {
	const stream = new MockStream(true);
	const reporter = new ConsoleProgressReporter({ isInteractive: true, stream });

	reporter.complete("wrote", "prodex@prodex/trace-main.md");
	assert.equal(stream.data.join("").endsWith("\n"), true);

	const stream2 = new MockStream(true);
	const reporter2 = new ConsoleProgressReporter({ isInteractive: true, stream: stream2 });
	reporter2.warn("low memory");
	assert.equal(stream2.data.join("").endsWith("\n"), true);
});

test("ConsoleProgressReporter - interactive heartbeat refreshes the same line with elapsed time", async () => {
	const stream = new MockStream(true);
	const originalNow = Date.now;
	let mockTime = 10000;
	Date.now = () => mockTime;

	try {
		const reporter = new ConsoleProgressReporter({ isInteractive: true, stream, heartbeatInterval: 10 });
		reporter.start("collecting dependency graph");

		mockTime += 5000;
		await new Promise(resolve => setTimeout(resolve, 25));
		reporter.finish();

		const fullOutput = stream.data.join("");
		assert.match(fullOutput, /collecting dependency graph\.\.\. 5s/);
		const lines = fullOutput.split("\n");
		assert.equal(lines.length, 2);
	} finally {
		Date.now = originalNow;
	}
});

test("ConsoleProgressReporter - timer is cleared on complete, warn, and finish", () => {
	const stream = new MockStream(true);
	const reporter = new ConsoleProgressReporter({ isInteractive: true, stream });

	reporter.start("loading project");
	assert.ok(reporter.timer !== null, "Timer should be active");

	reporter.complete("done");
	assert.equal(reporter.timer, null, "Timer should be cleared on complete");

	reporter.start("loading project");
	assert.ok(reporter.timer !== null, "Timer should be active");

	reporter.warn("memory warning");
	assert.equal(reporter.timer, null, "Timer should be cleared on warn");

	reporter.start("loading project");
	assert.ok(reporter.timer !== null, "Timer should be active");

	reporter.finish();
	assert.equal(reporter.timer, null, "Timer should be cleared on finish");
});

test("ConsoleProgressReporter - non-interactive mode does not emit heartbeat noise", async () => {
	const stream = new MockStream(false);
	const originalNow = Date.now;
	let mockTime = 10000;
	Date.now = () => mockTime;

	try {
		const reporter = new ConsoleProgressReporter({ isInteractive: false, stream, heartbeatInterval: 10 });
		reporter.start("collecting dependency graph");

		mockTime += 5000;
		await new Promise(resolve => setTimeout(resolve, 25));
		reporter.finish();

		const fullOutput = stream.data.join("");
		assert.equal(fullOutput.includes("5s"), false);
		assert.equal(reporter.timer, null);
	} finally {
		Date.now = originalNow;
	}
});

test("ConsoleProgressReporter - start followed by finish ends with newline in interactive mode", () => {
	const stream = new MockStream(true);
	const reporter = new ConsoleProgressReporter({ isInteractive: true, stream });

	reporter.start("loading project");
	assert.equal(stream.data.join("").endsWith("\n"), false);

	reporter.finish();
	assert.equal(stream.data.join("").endsWith("\n"), true);
});

test("ConsoleProgressReporter - calling finish after complete does not add an extra newline", () => {
	const stream = new MockStream(true);
	const reporter = new ConsoleProgressReporter({ isInteractive: true, stream });

	reporter.complete("wrote", "prodex@prodex/trace-main.md");
	const lenAfterComplete = stream.data.length;

	reporter.finish();
	const lenAfterFinish = stream.data.length;

	assert.equal(lenAfterFinish, lenAfterComplete, "Should not write anything after complete");
});

test("startProdex - early planning error path terminates progress line with newline", async () => {
	const originalWrite = process.stderr.write;
	let stderrOutput = "";
	process.stderr.write = (chunk) => {
		stderrOutput += chunk.toString();
		return true;
	};

	const originalExitCode = process.exitCode;
	try {
		const startProdex = require("../dist/index.js").default;
		await startProdex(["node", "prodex", "trace", "--target", "AlertService", "--depth", "-5"]);
	} finally {
		process.stderr.write = originalWrite;
		process.exitCode = originalExitCode;
	}

	assert.ok(stderrOutput.endsWith("\n"), "Output should terminate with a newline");
});

test("NoopProgressReporter - writes nothing", () => {
	const stream = new MockStream(false);
	const reporter = new NoopProgressReporter();

	reporter.start("loading project");
	reporter.update("planning command");
	reporter.complete("wrote", "prodex@prodex/trace-main.md");
	reporter.warn("low memory");

	assert.equal(stream.data.length, 0);
});

test("runProdexCommand - quiet by default in tests", async () => {
	const originalWrite = process.stderr.write;
	let written = "";
	process.stderr.write = (chunk) => {
		written += chunk.toString();
		return true;
	};

	try {
		const root = path.resolve(__dirname, "fixtures/universal-resolution/polyglot-basic");
		await runProdexCommand(["node", "prodex", "trace", "-t", "AlertService"], root);
	} finally {
		process.stderr.write = originalWrite;
	}

	assert.equal(written, "", "Tests must be completely quiet by default");
});

test("runProdexCommand - emits expected coarse stages when progress reporter is injected", async () => {
	const stream = new MockStream(false);
	const reporter = new ConsoleProgressReporter({ isInteractive: false, stream });

	const root = path.resolve(__dirname, "fixtures/universal-resolution/polyglot-basic");
	await runProdexCommand(["node", "prodex", "trace", "-t", "AlertService"], root, reporter);

	const fullOutput = stream.data.join("");
	assert.match(fullOutput, /Prodex: loading project\.\.\./);
	assert.match(fullOutput, /Prodex: planning command\.\.\./);
	assert.match(fullOutput, /Prodex: resolving target "AlertService"\.\.\./);
	assert.match(fullOutput, /Prodex: collecting dependency graph\.\.\./);
	assert.match(fullOutput, /Prodex: snapshotting files\.\.\./);
	assert.match(fullOutput, /Prodex: rendering artifact\.\.\./);
	assert.match(fullOutput, /Prodex: writing output\.\.\./);
	assert.match(fullOutput, /Prodex: wrote/);
});
