// @ts-nocheck
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { indexWorkspace } = require("../dist/dependency/workspace/index.js");
const { UniversalResolver } = require("../dist/dependency/resolve/resolver.js");
const { UniversalDependencyProvider } = require("../dist/dependency/provider/universal-provider.js");
const { classifyJsTsModuleSemantics } = require("../dist/dependency/capture/helpers/js-ts-semantics.js");
const { classifyPhpFileSemantics } = require("../dist/dependency/capture/helpers/php-file-semantics.js");
const { isStaticPathEligible } = require("../dist/dependency/resolve/classify.js");
const { TYPESCRIPT_PROFILE } = require("../dist/dependency/capture/profiles/typescript.js");

const JS_WASM = path.resolve(__dirname, "../assets/tree-sitter/tree-sitter-javascript.wasm");

// 1. Provider output — unresolved surfacing
test("4L-B Provider: unresolved module+relative is surfaced", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-sem-prov-"));
	try {
		fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "app" }, null, 2));
		const srcFile = path.join(root, "index.ts").replace(/\\/g, "/");
		// Write JS import that fails to resolve
		fs.writeFileSync(srcFile, 'import "./missing-relative";\n');

		const provider = await UniversalDependencyProvider.create({
			wasmPaths: { javascript: JS_WASM }
		});
		const res = await provider.resolve({
			root,
			filePath: srcFile
		});

		assert.equal(res.unresolved.length, 1);
		assert.equal(res.unresolved[0].specifier, "./missing-relative");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("4L-B Provider: unresolved module+absolute and unsupported uri are surfaced", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-sem-prov-abs-"));
	try {
		fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "app" }, null, 2));
		const srcFile = path.join(root, "index.ts").replace(/\\/g, "/");
		
		const index = await indexWorkspace(root);
		const resolver = new UniversalResolver(index);

		// Resolve absolute path not in index
		const absPath = path.join(root, "missing-abs.ts").replace(/\\/g, "/");
		const resAbs = resolver.resolve({
			specifier: absPath,
			intent: "dependency-edge",
			semantics: { domain: "module", resolution: "absolute" },
			sourceFile: srcFile
		});
		assert.equal(resAbs.status, "unresolved");

		// Resolve unsupported URI (e.g. file:)
		const resUri = resolver.resolve({
			specifier: "file:///tmp/foo.js",
			intent: "dependency-edge",
			semantics: { domain: "uri", resolution: "absolute" },
			sourceFile: srcFile
		});
		assert.equal(resUri.status, "unresolved");
		
		// In provider context, test both are surfaced:
		const provider = await UniversalDependencyProvider.create({
			wasmPaths: { javascript: JS_WASM }
		});
		
		fs.writeFileSync(srcFile, 'import "/opt/app/foo.js";\nimport "file:///tmp/bar.js";\n');
		const res = await provider.resolve({
			root,
			filePath: srcFile
		});

		const unresolvedSpecs = res.unresolved.map(u => u.specifier);
		assert.ok(unresolvedSpecs.includes("/opt/app/foo.js"));
		assert.ok(unresolvedSpecs.includes("file:///tmp/bar.js"));
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("4L-B Provider: unresolved module+logical is dropped from provider output", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-sem-prov-log-"));
	try {
		fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "app" }, null, 2));
		const srcFile = path.join(root, "index.ts").replace(/\\/g, "/");
		
		// "#react" is module+logical. Unresolved logical modules (external) should not be surfaced in provider.unresolved.
		fs.writeFileSync(srcFile, 'import "#react";\n');

		const provider = await UniversalDependencyProvider.create({
			wasmPaths: { javascript: JS_WASM }
		});
		const res = await provider.resolve({
			root,
			filePath: srcFile
		});

		assert.equal(res.unresolved.some(u => u.specifier === "#react"), false);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

// 2. Capture — JS/TS absolute path classification
test("4L-B Capture: JS/TS absolute path classification rules", () => {
	// POSIX absolute
	const resPos = classifyJsTsModuleSemantics("/opt/app/foo.js");
	assert.deepEqual(resPos, { domain: 'module', resolution: 'absolute' });

	// Windows absolute
	const resWin1 = classifyJsTsModuleSemantics("C:\\app\\foo.js");
	assert.deepEqual(resWin1, { domain: 'module', resolution: 'absolute' });
	const resWin2 = classifyJsTsModuleSemantics("d:/app/bar.js");
	assert.deepEqual(resWin2, { domain: 'module', resolution: 'absolute' });
	const resWin3 = classifyJsTsModuleSemantics("\\\\server\\share\\path");
	assert.deepEqual(resWin3, { domain: 'module', resolution: 'absolute' });

	// Relative
	const resRel = classifyJsTsModuleSemantics("./foo");
	assert.deepEqual(resRel, { domain: 'module', resolution: 'relative', anchor: 'source' });

	// Logical
	const resLog = classifyJsTsModuleSemantics("lodash-es");
	assert.deepEqual(resLog, { domain: 'module', resolution: 'logical' });

	// URI
	const resUri = classifyJsTsModuleSemantics("https://example.com/mod.js");
	assert.deepEqual(resUri, { domain: 'uri', resolution: 'absolute' });
});

// 3. Resolution — `module + absolute` enters path pipeline
test("4L-B Resolution: module+absolute resolves via L3/path, bypassing ownership & aliases", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-sem-res-abs-"));
	try {
		const targetFile = path.join(root, "opt/app/foo.ts").replace(/\\/g, "/");
		fs.mkdirSync(path.dirname(targetFile), { recursive: true });
		fs.writeFileSync(targetFile, "export const foo = 1;\n");
		fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "app" }, null, 2));

		const index = await indexWorkspace(root);
		const resolver = new UniversalResolver(index);

		// With module+absolute semantics, we expect it to resolve via exact-path/L3
		const res = resolver.resolve({
			specifier: targetFile,
			intent: "dependency-edge",
			semantics: { domain: "module", resolution: "absolute" },
			sourceFile: path.join(root, "index.ts").replace(/\\/g, "/"),
			aliases: {
				[targetFile]: "should-be-ignored-alias"
			}
		});

		assert.equal(res.status, "resolved");
		assert.equal(res.level, "L3");
		assert.equal(res.strategy, "exact-path");
		assert.equal(res.file, targetFile);
		assert.equal(res.ownership, undefined); // Bypassed ownership gate entirely!
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

// 4. Ownership — gate and dispatch alignment
test("4L-B Ownership: intent requirement, semantics split & alignment", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-sem-own-"));
	try {
		fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "app", dependencies: { "lodash": "^4.0.0" } }, null, 2));
		const index = await indexWorkspace(root);
		const resolver = new UniversalResolver(index);

		// A: dependency-edge intent required for semantics
		const resSeed = resolver.resolve({
			specifier: "lodash",
			intent: "seed-target",
			semantics: { domain: "module", resolution: "logical" },
			sourceLanguage: "typescript",
			sourceFile: path.join(root, "index.ts").replace(/\\/g, "/"),
			profile: TYPESCRIPT_PROFILE
		});
		// Since intent is seed-target, it should bypass ownership and fall to L7 (or unresolved if no matches)
		assert.notEqual(resSeed.strategy, "ownership-policy");
		assert.equal(resSeed.ownership, undefined);

		// B: dependency-edge intent required for compatibility path too
		const resSeedCompat = resolver.resolve({
			specifier: "lodash",
			intent: "seed-target",
			sourceLanguage: "typescript",
			sourceFile: path.join(root, "index.ts").replace(/\\/g, "/"),
			profile: TYPESCRIPT_PROFILE
		});
		assert.notEqual(resSeedCompat.strategy, "ownership-policy");
		assert.equal(resSeedCompat.ownership, undefined);

		// C: syntaxKind alone does not establish JS/TS when semantics are present
		const resSyntaxSem = resolver.resolve({
			specifier: "lodash",
			intent: "dependency-edge",
			syntaxKind: "esm-import", // syntaxKind has esm-import but no language, and semantics are present
			semantics: { domain: "module", resolution: "logical" },
			sourceFile: path.join(root, "index.ts").replace(/\\/g, "/")
		});
		assert.notEqual(resSyntaxSem.strategy, "ownership-policy");

		// D: syntaxKind alone establishes JS/TS when semantics are absent (legacy compatibility)
		const resSyntaxCompat = resolver.resolve({
			specifier: "lodash",
			intent: "dependency-edge",
			syntaxKind: "esm-import",
			sourceFile: path.join(root, "index.ts").replace(/\\/g, "/"),
			profile: TYPESCRIPT_PROFILE
		});
		assert.equal(resSyntaxCompat.status, "external");
		assert.equal(resSyntaxCompat.strategy, "ownership-policy");
		assert.equal(resSyntaxCompat.ownership?.kind, "external");

		// E: relative reference excluded from ownership
		const resRel = resolver.resolve({
			specifier: "./local",
			intent: "dependency-edge",
			semantics: { domain: "module", resolution: "relative", anchor: "source" },
			sourceLanguage: "typescript",
			sourceFile: path.join(root, "index.ts").replace(/\\/g, "/"),
			profile: TYPESCRIPT_PROFILE
		});
		assert.notEqual(resRel.strategy, "ownership-policy");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

// 5. TSConfig applicability with explicit semantics
test("4L-B TSConfig: explicit semantics with/without JS/TS ecosystem evidence", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-sem-tsconfig-"));
	try {
		fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "app" }, null, 2));
		fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({
			compilerOptions: {
				baseUrl: ".",
				paths: {
					"@/*": ["src/*"],
					"/opt/app/helper": ["src/helper.ts"],
					"C:/app/helper": ["src/helper.ts"],
					"file:///tmp/helper": ["src/helper.ts"]
				}
			}
		}, null, 2));
		fs.mkdirSync(path.join(root, "src"), { recursive: true });
		fs.writeFileSync(path.join(root, "src/helper.ts"), "export const helper = 1;\n");

		const index = await indexWorkspace(root);
		const resolver = new UniversalResolver(index);

		// A: Explicit semantics, no JS/TS language/evidence -> TSConfig resolution is skipped
		const resNoEcosystem = resolver.resolve({
			specifier: "@/helper",
			intent: "dependency-edge",
			semantics: { domain: "module", resolution: "logical" },
			// sourceFile/origin/language not provided -> no JS/TS evidence
			aliases: {}
		});
		assert.notEqual(resNoEcosystem.strategy, "tsconfig-paths");

		// B: Explicit semantics, positive JS/TS evidence -> TSConfig resolution proceeds
		const resWithEcosystem = resolver.resolve({
			specifier: "@/helper",
			intent: "dependency-edge",
			semantics: { domain: "module", resolution: "logical" },
			sourceLanguage: "typescript",
			sourceFile: path.join(root, "src/main.ts").replace(/\\/g, "/"),
			profile: TYPESCRIPT_PROFILE
		});
		assert.equal(resWithEcosystem.status, "resolved");
		assert.equal(resWithEcosystem.strategy, "tsconfig-paths");
		assert.equal(resWithEcosystem.file, path.join(root, "src/helper.ts").replace(/\\/g, "/"));

		// C: module + absolute with tsconfig paths matching it -> L8 tsconfig-paths resolution is skipped
		const isWin = process.platform === "win32";
		const absSpecifier = isWin ? "C:/app/helper" : "/opt/app/helper";
		const resModuleAbsolute = resolver.resolve({
			specifier: absSpecifier,
			intent: "dependency-edge",
			semantics: { domain: "module", resolution: "absolute" },
			sourceLanguage: "typescript",
			sourceFile: path.join(root, "src/main.ts").replace(/\\/g, "/"),
			profile: TYPESCRIPT_PROFILE
		});
		assert.notEqual(resModuleAbsolute.strategy, "tsconfig-paths");

		// D: uri + absolute with tsconfig paths matching it -> L8 tsconfig-paths resolution is skipped
		const resUriAbsolute = resolver.resolve({
			specifier: "file:///tmp/helper",
			intent: "dependency-edge",
			semantics: { domain: "uri", resolution: "absolute" },
			sourceLanguage: "typescript",
			sourceFile: path.join(root, "src/main.ts").replace(/\\/g, "/"),
			profile: TYPESCRIPT_PROFILE
		});
		assert.notEqual(resUriAbsolute.strategy, "tsconfig-paths");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

// 6. PHP capture — no regression
test("4L-B PHP Capture: PHP file-reference semantic helpers", () => {
	// Relative path
	assert.deepEqual(classifyPhpFileSemantics("./foo.php"), { domain: "file", resolution: "relative", anchor: "runtime" });
	assert.deepEqual(classifyPhpFileSemantics("../bar.php"), { domain: "file", resolution: "relative", anchor: "runtime" });

	// Absolute POSIX & Windows path
	assert.deepEqual(classifyPhpFileSemantics("/var/www/index.php"), { domain: "file", resolution: "absolute" });
	assert.deepEqual(classifyPhpFileSemantics("C:\\inetpub\\wwwroot\\index.php"), { domain: "file", resolution: "absolute" });
	assert.deepEqual(classifyPhpFileSemantics("d:/wamp/www/index.php"), { domain: "file", resolution: "absolute" });

	// Bare/search
	assert.deepEqual(classifyPhpFileSemantics("config.php"), { domain: "file", resolution: "search" });
});

// 7. Positive static path eligibility checks
test("4L-B Static Path Eligibility helper", () => {
	// Positive cases (must return true)
	assert.equal(isStaticPathEligible({ semantics: { domain: "file", resolution: "absolute" } }), true);
	assert.equal(isStaticPathEligible({ semantics: { domain: "file", resolution: "relative", anchor: "source" } }), true);
	assert.equal(isStaticPathEligible({ semantics: { domain: "module", resolution: "absolute" } }), true);
	assert.equal(isStaticPathEligible({ semantics: { domain: "module", resolution: "relative", anchor: "source" } }), true);

	// Negative cases (must return false)
	assert.equal(isStaticPathEligible({ semantics: { domain: "file", resolution: "relative", anchor: "runtime" } }), false);
	assert.equal(isStaticPathEligible({ semantics: { domain: "file", resolution: "search" } }), false);
	assert.equal(isStaticPathEligible({ semantics: { domain: "module", resolution: "logical" } }), false);
	assert.equal(isStaticPathEligible({ semantics: { domain: "uri", resolution: "absolute" } }), false);
	assert.equal(isStaticPathEligible({ semantics: { domain: "symbol", resolution: "logical" } }), false);

	// No semantics (must return undefined)
	assert.equal(isStaticPathEligible({}), undefined);
});
