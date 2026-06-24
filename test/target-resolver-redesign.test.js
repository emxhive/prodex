const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { resolveTargets } = require("../dist/app/target-resolver.js");

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

test("extensionless root expansion resolves root target.ts", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "target.ts"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["target"]
		});
		assert.equal(result.errors.length, 0);
		assert.deepEqual(result.entries, [path.resolve(root, "target.ts")]);
	});
});

test("extensionless nested stem discovery resolves some/nested/target.ts", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "some/nested/target.ts"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["target"]
		});
		assert.equal(result.errors.length, 0);
		assert.deepEqual(result.entries, [path.resolve(root, "some/nested/target.ts")]);
	});
});

test("extensionless nested index discovery resolves some/nested/target/index.ts", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "some/nested/target/index.ts"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["target"]
		});
		assert.equal(result.errors.length, 0);
		assert.deepEqual(result.entries, [path.resolve(root, "some/nested/target/index.ts")]);
	});
});

test("extension-bearing bare target at root resolves target.tsx", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "target.tsx"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["target.tsx"]
		});
		assert.equal(result.errors.length, 0);
		assert.deepEqual(result.entries, [path.resolve(root, "target.tsx")]);
	});
});

test("extension-bearing bare target nested uniquely resolves some/nested/path/target.tsx", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "some/nested/path/target.tsx"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["target.tsx"]
		});
		assert.equal(result.errors.length, 0);
		assert.deepEqual(result.entries, [path.resolve(root, "some/nested/path/target.tsx")]);
	});
});

test("extension-bearing bare target with multiple matches returns ambiguity", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "a/target.tsx"), "content");
		writeFile(path.join(root, "b/target.tsx"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["target.tsx"]
		});
		assert.equal(result.errors.length, 1);
		assert.match(result.errors[0], /Ambiguous target "target.tsx". Basename matches:/);
		assert.match(result.errors[0], /a\/target\.tsx/);
		assert.match(result.errors[0], /b\/target\.tsx/);
		assert.match(result.errors[0], /Use a more specific target\./);
	});
});

test("path-like target exact at root resolves src/target.tsx", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "src/target.tsx"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["src/target.tsx"]
		});
		assert.equal(result.errors.length, 0);
		assert.deepEqual(result.entries, [path.resolve(root, "src/target.tsx")]);
	});
});

test("path-like target resolved by suffix discovery resolves x/y/src/target.tsx", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "x/y/src/target.tsx"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["src/target.tsx"]
		});
		assert.equal(result.errors.length, 0);
		assert.deepEqual(result.entries, [path.resolve(root, "x/y/src/target.tsx")]);
	});
});

test("path-like target with multiple suffix matches returns ambiguity", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "x/src/target.tsx"), "content");
		writeFile(path.join(root, "y/src/target.tsx"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["src/target.tsx"]
		});
		assert.equal(result.errors.length, 1);
		assert.match(result.errors[0], /Ambiguous target "src\/target.tsx"\. Suffix matches:/);
		assert.match(result.errors[0], /x\/src\/target\.tsx/);
		assert.match(result.errors[0], /y\/src\/target\.tsx/);
		assert.match(result.errors[0], /Use a more specific target\./);
	});
});

test("exact priority: exact root-relative wins even with nested match", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "src/target.tsx"), "content");
		writeFile(path.join(root, "x/src/target.tsx"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["src/target.tsx"]
		});
		assert.equal(result.errors.length, 0);
		assert.deepEqual(result.entries, [path.resolve(root, "src/target.tsx")]);
	});
});

test("excluded exact match does not fall back", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "src/target.tsx"), "content");
		writeFile(path.join(root, "x/src/target.tsx"), "content");
		const result = await resolveTargets({
			root,
			exclude: ["src/**"],
			target: ["src/target.tsx"]
		});
		assert.equal(result.entries.length, 0);
		assert.equal(result.errors.length, 1);
		assert.match(result.errors[0], /Target "src\/target.tsx" exists but is excluded by the active exclude rules\./);
	});
});

test("case-insensitive fallback compares case-insensitively and preserves original casing", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "some/nested/TargetName.tsx"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["targetname.tsx"]
		});
		assert.equal(result.errors.length, 0);
		assert.deepEqual(result.entries, [path.resolve(root, "some/nested/TargetName.tsx")]);
	});
});

test("path-like suffix discovery works with Windows-style backslashes in target", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "x/y/src/target.tsx"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["src\\target.tsx"]
		});
		assert.equal(result.errors.length, 0);
		assert.deepEqual(result.entries, [path.resolve(root, "x/y/src/target.tsx")]);
	});
});

test("extensionless path-like suffix discovery resolves x/y/src/target.tsx", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "x/y/src/target.tsx"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["src/target"]
		});
		assert.equal(result.errors.length, 0);
		assert.deepEqual(result.entries, [path.resolve(root, "x/y/src/target.tsx")]);
	});
});

test("extensionless path-like suffix discovery resolves x/y/src/target/index.tsx", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "x/y/src/target/index.tsx"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["src/target"]
		});
		assert.equal(result.errors.length, 0);
		assert.deepEqual(result.entries, [path.resolve(root, "x/y/src/target/index.tsx")]);
	});
});

test("case-insensitive suffix fallback compares case-insensitively and preserves original casing", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "x/y/Src/Target.tsx"), "content");
		const result = await resolveTargets({
			root,
			exclude: [],
			target: ["src/target.tsx"]
		});
		assert.equal(result.errors.length, 0);
		assert.deepEqual(result.entries, [path.resolve(root, "x/y/Src/Target.tsx")]);
	});
});

