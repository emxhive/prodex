const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { indexWorkspace } = require("../dist/dependency/workspace/index.js");
const { UniversalResolver } = require("../dist/dependency/resolve/resolver.js");
const { DebugCollector } = require("../dist/dependency/debug/collector.js");
const { PHP_PROFILE } = require("../dist/dependency/capture/profiles/php.js");
const { JAVASCRIPT_PROFILE } = require("../dist/dependency/capture/profiles/javascript.js");
const { TYPESCRIPT_PROFILE } = require("../dist/dependency/capture/profiles/typescript.js");
const { TSX_PROFILE } = require("../dist/dependency/capture/profiles/tsx.js");

// Resolve root path for fixtures
const FIXTURES_DIR = path.resolve(__dirname, "fixtures/universal-resolution");

// Helper to get normalized absolute path for a fixture relative file
function getFixtureFile(fixture, relPath) {
	return path.join(FIXTURES_DIR, fixture, relPath).replace(/\\/g, "/");
}

const testCases = [
	// --- L1: External, System & URL Filtering (Active / Must-never-resolve) ---
	{
		name: "L1: external package lodash in dependency edge",
		fixture: "external-filtering",
		specifier: "lodash",
		intent: "dependency-edge",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.ts",
		state: "active",
		expectedStatus: "external",
		expectedLevel: "L1",
		expectedStrategy: "external-filter"
	},
	{
		name: "L1: external system module fs in dependency edge",
		fixture: "external-filtering",
		specifier: "fs",
		intent: "dependency-edge",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.ts",
		state: "active",
		expectedStatus: "external",
		expectedLevel: "L1",
		expectedStrategy: "external-filter"
	},
	{
		name: "L1: external system module node:fs in dependency edge",
		fixture: "external-filtering",
		specifier: "node:fs",
		intent: "dependency-edge",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.ts",
		state: "active",
		expectedStatus: "external",
		expectedLevel: "L1",
		expectedStrategy: "external-filter"
	},
	{
		name: "L1: URL imports are resolved as external",
		fixture: "external-filtering",
		specifier: "https://deno.land/x/mock/mod.ts",
		intent: "dependency-edge",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.ts",
		state: "active",
		expectedStatus: "external",
		expectedLevel: "L1",
		expectedStrategy: "url-filter"
	},

	// --- L1 Fallback / Conservative Checking (Active Tests) ---
	{
		name: "L1 fallback: PHP namespace-like specifiers are not external",
		fixture: "polyglot-basic",
		specifier: "App\\Services\\AlertService",
		intent: "dependency-edge",
		sourceLanguage: "php",
		syntaxKind: "use-statement",
		sourceFile: "app/Services/AlertService.php",
		state: "active",
		expectedStatus: "unresolved",
		expectedLevel: "LX",
		expectedStrategy: "unresolved-fallback"
	},
	{
		name: "L1 fallback: Python module-like specifiers are not external",
		fixture: "polyglot-basic",
		specifier: "tools.shared.queue",
		intent: "dependency-edge",
		sourceLanguage: "python",
		syntaxKind: "import-statement",
		sourceFile: "tools/worker.py",
		state: "active",
		expectedStatus: "unresolved",
		expectedLevel: "LX",
		expectedStrategy: "unresolved-fallback"
	},
	{
		name: "L1 fallback: TS alias-like specifiers are not external",
		fixture: "profile-rewrites",
		specifier: "~/helper",
		intent: "dependency-edge",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.ts",
		state: "active",
		expectedStatus: "unresolved",
		expectedLevel: "LX",
		expectedStrategy: "unresolved-fallback"
	},
	{
		name: "L1 fallback: TS import-map private alias is not external",
		fixture: "profile-rewrites",
		specifier: "#internal/foo",
		intent: "dependency-edge",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.ts",
		state: "active",
		expectedStatus: "unresolved",
		expectedLevel: "LX",
		expectedStrategy: "unresolved-fallback"
	},
	{
		name: "L1 fallback: Go module-like paths are not external",
		fixture: "polyglot-basic",
		specifier: "sample-repo/internal",
		intent: "dependency-edge",
		sourceLanguage: "go",
		syntaxKind: "import-statement",
		sourceFile: "src/main.ts",
		state: "active",
		expectedStatus: "unresolved",
		expectedLevel: "LX",
		expectedStrategy: "unresolved-fallback"
	},
	{
		name: "L1 fallback: Rust module paths are not external",
		fixture: "polyglot-basic",
		specifier: "crate::foo",
		intent: "dependency-edge",
		sourceLanguage: "rust",
		syntaxKind: "use-statement",
		sourceFile: "src/main.ts",
		state: "active",
		expectedStatus: "unresolved",
		expectedLevel: "LX",
		expectedStrategy: "unresolved-fallback"
	},

	// --- L2: Workspace Boundary Enforcement (Active / Must-never-resolve) ---
	{
		name: "L2: block relative path escaping root",
		fixture: "boundary",
		specifier: "../../outside.ts",
		intent: "dependency-edge",
		origin: "src/main.ts",
		state: "active",
		expectedStatus: "blocked",
		expectedLevel: "L2",
		expectedStrategy: "boundary"
	},
	{
		name: "L2: block absolute path escaping root",
		fixture: "boundary",
		specifier: "/outside/file.ts",
		intent: "dependency-edge",
		origin: "src/main.ts",
		state: "active",
		expectedStatus: "blocked",
		expectedLevel: "L2",
		expectedStrategy: "boundary"
	},
	{
		name: "L2 blocks escaping dependency path using sourceFile when origin is absent",
		fixture: "boundary",
		specifier: "../../outside.ts",
		intent: "dependency-edge",
		sourceFile: "src/main.ts",
		state: "active",
		expectedStatus: "blocked",
		expectedLevel: "L2",
		expectedStrategy: "boundary"
	},

	// --- L3: Exact Path Resolution (Active) ---
	{
		name: "L3: resolve exact relative file inside basic fixture",
		fixture: "polyglot-basic",
		specifier: "./shared/logger.ts",
		intent: "dependency-edge",
		origin: "src/main.ts",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L3",
		expectedStrategy: "exact-path",
		expectedFile: "src/shared/logger.ts"
	},
	{
		name: "L3: resolve exact relative PHP file crossing directories",
		fixture: "polyglot-basic",
		specifier: "../app/Services/AlertService.php",
		intent: "dependency-edge",
		origin: "src/main.ts",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L3",
		expectedStrategy: "exact-path",
		expectedFile: "app/Services/AlertService.php"
	},
	{
		name: "L3 resolves relative dependency using sourceFile when origin is absent",
		fixture: "polyglot-basic",
		specifier: "./shared/logger.ts",
		intent: "dependency-edge",
		sourceFile: "src/main.ts",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L3",
		expectedStrategy: "exact-path",
		expectedFile: "src/shared/logger.ts"
	},

	// --- L7: Global Stem/Basename Seed Targets (Active) ---
	{
		name: "L7: resolve unique global seed by stem",
		fixture: "polyglot-basic",
		specifier: "AlertService",
		intent: "seed-target",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L7",
		expectedStrategy: "global-seed",
		expectedFile: "app/Services/AlertService.php"
	},
	{
		name: "L7: resolve unique global seed by basename",
		fixture: "polyglot-basic",
		specifier: "worker.py",
		intent: "seed-target",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L7",
		expectedStrategy: "global-seed",
		expectedFile: "tools/worker.py"
	},
	{
		name: "L7: global seed ambiguity matches multiple files",
		fixture: "ambiguity",
		specifier: "foo",
		intent: "seed-target",
		state: "active",
		expectedStatus: "ambiguous",
		expectedLevel: "L7",
		expectedStrategy: "global-seed",
		expectedCandidates: ["src/foo.ts", "src/bar/foo.ts"]
	},

	// --- LX: Must-Never-Resolve Dynamic Cases (Active / Must-never-resolve) ---
	{
		name: "LX: JS dynamic import with template expression",
		fixture: "polyglot-basic",
		specifier: "`./modules/${name}.js`",
		intent: "dependency-edge",
		origin: "src/main.ts",
		state: "must-never-resolve",
		expectedStatus: "unresolved",
		expectedLevel: "LX",
		expectedStrategy: "unresolved-dynamic"
	},
	{
		name: "LX: JS dynamic require",
		fixture: "polyglot-basic",
		specifier: "require(name)",
		intent: "dependency-edge",
		origin: "src/main.ts",
		state: "must-never-resolve",
		expectedStatus: "unresolved",
		expectedLevel: "LX",
		expectedStrategy: "unresolved-dynamic"
	},
	{
		name: "LX: Python dynamic importlib module loading",
		fixture: "polyglot-basic",
		specifier: "importlib.import_module(name)",
		intent: "dependency-edge",
		origin: "tools/worker.py",
		state: "must-never-resolve",
		expectedStatus: "unresolved",
		expectedLevel: "LX",
		expectedStrategy: "unresolved-dynamic"
	},
	{
		name: "LX: PHP dynamic require variable",
		fixture: "polyglot-basic",
		specifier: "require $path",
		intent: "dependency-edge",
		origin: "app/Services/AlertService.php",
		state: "must-never-resolve",
		expectedStatus: "unresolved",
		expectedLevel: "LX",
		expectedStrategy: "unresolved-dynamic"
	},

	// --- L3.5: Source-Equivalent Sibling Remap (Active) ---
	{
		name: "L3.5: resolve unique source-equivalent sibling main.ts when main.js is absent",
		fixture: "local-path-completion",
		specifier: "../js-to-ts/main.js",
		intent: "dependency-edge",
		origin: "src/main.tsx",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.tsx",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L3.5",
		expectedStrategy: "source-equiv-sibling",
		expectedFile: "js-to-ts/main.ts"
	},
	{
		name: "L3.5: exact path wins over source-equiv sibling when the exact file exists",
		fixture: "local-path-completion",
		specifier: "../lib/main.js",
		intent: "dependency-edge",
		origin: "src/main.tsx",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.tsx",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L3",
		expectedStrategy: "exact-path",
		expectedFile: "lib/main.js"
	},
	{
		name: "L3.5: returns ambiguous when multiple equivalent candidates exist",
		fixture: "local-path-completion",
		specifier: "../multi-equiv/mod.js",
		intent: "dependency-edge",
		origin: "src/main.tsx",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.tsx",
		state: "active",
		expectedStatus: "ambiguous",
		expectedLevel: "L3.5",
		expectedStrategy: "source-equiv-sibling",
		expectedCandidates: ["multi-equiv/mod.ts", "multi-equiv/mod.tsx"]
	},
	{
		name: "L3.5: declaration-only file .d.ts is ignored as candidate",
		fixture: "local-path-completion",
		specifier: "../dts-only/types.js",
		intent: "dependency-edge",
		origin: "src/main.tsx",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.tsx",
		state: "active",
		expectedStatus: "unresolved",
		expectedLevel: "LX",
		expectedStrategy: "unresolved-fallback"
	},

	// --- L4: Caller-Priority Extension Completion (Active) ---
	{
		name: "L4: TSX caller resolves extensionless path to highest priority group button.tsx",
		fixture: "local-path-completion",
		specifier: "./button",
		intent: "dependency-edge",
		origin: "src/main.tsx",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.tsx",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L4",
		expectedStrategy: "caller-priority-ext",
		expectedFile: "src/button.tsx"
	},
	{
		name: "L4: TSX caller with sourceLanguage 'typescript' and sourceFile 'src/main.tsx' resolving './button' must resolve src/button.tsx at L4 (proves file extension is preferred over generic typescript language)",
		fixture: "local-path-completion",
		specifier: "./button",
		intent: "dependency-edge",
		origin: "src/main.tsx",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.tsx",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L4",
		expectedStrategy: "caller-priority-ext",
		expectedFile: "src/button.tsx"
	},
	{
		name: "L4: unknown context has no priority groups and falls through to L5",
		fixture: "local-path-completion",
		specifier: "./src/button",
		intent: "dependency-edge",
		state: "active",
		expectedStatus: "ambiguous",
		expectedLevel: "L5",
		expectedStrategy: "workspace-ext-fallback",
		expectedCandidates: ["src/button.ts", "src/button.tsx"]
	},

	// --- L5: Workspace-Extension Fallback (Active) ---
	{
		name: "L5: resolves using workspace extensions when caller context is omitted",
		fixture: "local-path-completion",
		specifier: "./shared/utils",
		intent: "dependency-edge",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L5",
		expectedStrategy: "workspace-ext-fallback",
		expectedFile: "shared/utils.ts"
	},
	{
		name: "L5: returns ambiguous when multiple workspace extension candidates exist",
		fixture: "local-path-completion",
		specifier: "./shared-ambiguous/data",
		intent: "dependency-edge",
		state: "active",
		expectedStatus: "ambiguous",
		expectedLevel: "L5",
		expectedStrategy: "workspace-ext-fallback",
		expectedCandidates: ["shared-ambiguous/data.ts", "shared-ambiguous/data.php"]
	},

	// --- L6: Directory Entry Resolution (Active) ---
	{
		name: "L6: directory import resolves index file with high confidence under TSX caller context",
		fixture: "local-path-completion",
		specifier: "./routes",
		intent: "dependency-edge",
		origin: "src/main.tsx",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.tsx",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L6",
		expectedStrategy: "directory-entry",
		expectedFile: "src/routes/index.ts"
	},
	{
		name: "L6: TSX caller with sourceLanguage 'typescript' and sourceFile 'src/main.tsx' resolving './routes-priority' must resolve src/routes-priority/index.tsx at L6 (proves file extension is preferred over generic typescript language)",
		fixture: "local-path-completion",
		specifier: "./routes-priority",
		intent: "dependency-edge",
		origin: "src/main.tsx",
		sourceLanguage: "typescript",
		syntaxKind: "esm-import",
		sourceFile: "src/main.tsx",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L6",
		expectedStrategy: "directory-entry",
		expectedFile: "src/routes-priority/index.tsx"
	},
	{
		name: "L6: directory import fallback to workspace-present extensions with low confidence when caller context is omitted",
		fixture: "local-path-completion",
		specifier: "./src/routes",
		intent: "dependency-edge",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L6",
		expectedStrategy: "directory-entry",
		expectedFile: "src/routes/index.ts"
	},
	{
		name: "L6: directory import returns ambiguous in workspace fallback when multiple index files exist",
		fixture: "local-path-completion",
		specifier: "./src/routes-multi",
		intent: "dependency-edge",
		state: "active",
		expectedStatus: "ambiguous",
		expectedLevel: "L6",
		expectedStrategy: "directory-entry",
		expectedCandidates: ["src/routes-multi/index.ts", "src/routes-multi/index.php"]
	},
	{
		name: "L6: directory import returns no-decision when directory has no entry files",
		fixture: "local-path-completion",
		specifier: "./src",
		intent: "dependency-edge",
		state: "active",
		expectedStatus: "unresolved",
		expectedLevel: "LX",
		expectedStrategy: "unresolved-fallback"
	},
	{
		name: "L8: TS path alias rewrite",
		fixture: "profile-rewrites",
		specifier: "@/helper",
		intent: "dependency-edge",
		origin: "src/main.ts",
		state: "active",
		expectedStatus: "resolved",
		expectedLevel: "L8",
		expectedStrategy: "tsconfig-paths",
		expectedFile: "src/helper.ts"
	},
	{
		name: "L9: runtime/source profile remap extensions (planned)",
		fixture: "profile-remap-extensions",
		specifier: "./helper.js",
		intent: "dependency-edge",
		origin: "src/main.ts",
		state: "planned",
		expectedStatus: "resolved",
		expectedLevel: "L9"
	},
	{
		name: "L10: PHP PSR-4 namespace rewrite (planned)",
		fixture: "polyglot-basic",
		specifier: "App\\Services\\AlertService",
		intent: "dependency-edge",
		origin: "app/Services/AlertService.php",
		expectedStatus: "resolved",
		expectedLevel: "L10",
		expectedFile: "app/Services/AlertService.php"
	},
	{
		name: "L10: Python module path rewrite (planned)",
		fixture: "polyglot-basic",
		specifier: "shared.queue",
		intent: "dependency-edge",
		origin: "tools/worker.py",
		state: "planned",
		expectedStatus: "resolved",
		expectedLevel: "L10"
	},
	{
		name: "L10: Go module/package resolution (planned)",
		fixture: "polyglot-basic",
		specifier: "polyglot-basic/internal",
		intent: "dependency-edge",
		origin: "src/main.ts",
		state: "planned",
		expectedStatus: "resolved",
		expectedLevel: "L10"
	},
	{
		name: "L10: Rust module resolution (planned)",
		fixture: "polyglot-basic",
		specifier: "crate::some_module",
		intent: "dependency-edge",
		origin: "src/main.ts",
		state: "planned",
		expectedStatus: "resolved",
		expectedLevel: "L10"
	},
	// --- TypeScript-Family Resolution ---
	{
		name: "TS: extensionless import from .ts prefers .ts before .js",
		fixture: "typescript-basic",
		specifier: "./helper",
		intent: "dependency-edge",
		origin: "src/main.ts",
		profile: TYPESCRIPT_PROFILE,
		expectedStatus: "resolved",
		expectedLevel: "L4",
		expectedFile: "src/helper.ts"
	},
	{
		name: "TSX: extensionless import from .tsx prefers .tsx before .ts/.js",
		fixture: "typescript-basic",
		specifier: "./component",
		intent: "dependency-edge",
		origin: "src/component.tsx",
		profile: TSX_PROFILE,
		expectedStatus: "resolved",
		expectedLevel: "L4",
		expectedFile: "src/component.tsx"
	},
	{
		name: "TS: import written as ./dep.js resolves to dep.ts when dep.js is absent",
		fixture: "typescript-basic",
		specifier: "./dep.js",
		intent: "dependency-edge",
		origin: "src/main.ts",
		profile: TYPESCRIPT_PROFILE,
		expectedStatus: "resolved",
		expectedLevel: "L3.5",
		expectedFile: "src/dep.ts"
	},
	{
		name: "TS: import written as ./nav-component.jsx resolves to nav-component.tsx when jsx is absent",
		fixture: "typescript-basic",
		specifier: "./nav-component.jsx",
		intent: "dependency-edge",
		origin: "src/main.ts",
		profile: TYPESCRIPT_PROFILE,
		expectedStatus: "resolved",
		expectedLevel: "L3.5",
		expectedFile: "src/nav-component.tsx"
	},
	{
		name: "TS: declaration file .d.ts should not resolve via source-equivalent sibling for ordinary imports",
		fixture: "typescript-basic",
		specifier: "./other",
		intent: "dependency-edge",
		origin: "src/main.ts",
		profile: TYPESCRIPT_PROFILE,
		expectedStatus: "unresolved",
		expectedLevel: "LX"
	}
];

// Run Workspace Indexing Tests
test("Workspace index builds correct structure and respects exclusions", async () => {
	const root = path.join(FIXTURES_DIR, "polyglot-basic");
	const debugCollector = new DebugCollector();
	
	const index = await indexWorkspace(root, ["node_modules/**", "vendor/**", "dist/**"], (e) => debugCollector.emit(e.category, e.data, e.message));
	
	assert.ok(index.filesByAbsolute.size > 0);
	const mainAbs = getFixtureFile("polyglot-basic", "src/main.ts");
	assert.ok(index.filesByAbsolute.has(mainAbs));
	
	const fileInfo = index.filesByAbsolute.get(mainAbs);
	assert.equal(fileInfo.basename, "main.ts");
	assert.equal(fileInfo.stem, "main");
	assert.equal(fileInfo.extension, ".ts");
	assert.equal(fileInfo.normalizedRelativePath, "src/main.ts");
	assert.equal(fileInfo.directory, path.join(root, "src").replace(/\\/g, "/"));

	assert.ok(index.extensionsPresent.has(".ts"));
	assert.ok(index.extensionsPresent.has(".php"));
	assert.ok(index.extensionsPresent.has(".py"));
	assert.ok(index.extensionsPresent.has(".go"));
	
	const nodeModulesAbs = getFixtureFile("polyglot-basic", "node_modules/some-package/index.js");
	assert.ok(!index.filesByAbsolute.has(nodeModulesAbs));

	const srcDirAbs = path.join(root, "src").replace(/\\/g, "/");
	assert.ok(index.directories.has(srcDirAbs));
	const srcDirEntry = index.directories.get(srcDirAbs);
	assert.ok(srcDirEntry.files.includes(mainAbs));

	const events = debugCollector.getEvents();
	assert.ok(events.some(e => e.category === "workspace:index:start"));
	assert.ok(events.some(e => e.category === "workspace:index:complete"));
});

// Run table-driven resolution test cases
for (const tc of testCases) {
	if (tc.state === "planned") {
		test(tc.name, { todo: "Roadmap: planned universal/language resolution strategies" }, async () => {
			// No implementation required to pass
		});
	} else {
		test(tc.name, async () => {
			const root = path.join(FIXTURES_DIR, tc.fixture);
			const index = await indexWorkspace(root, ["node_modules/**"]);
			
			const debugCollector = new DebugCollector();
			const resolver = new UniversalResolver(index, debugCollector);

			const originPath = tc.origin ? getFixtureFile(tc.fixture, tc.origin) : undefined;

			let profile = tc.profile;
			if (!profile && originPath && originPath.endsWith(".php")) {
				profile = PHP_PROFILE;
			} else if (!profile && originPath && (originPath.endsWith(".js") || originPath.endsWith(".mjs") || originPath.endsWith(".cjs"))) {
				profile = JAVASCRIPT_PROFILE;
			} else if (!profile && originPath && (originPath.endsWith(".ts") || originPath.endsWith(".d.ts"))) {
				profile = TYPESCRIPT_PROFILE;
			} else if (!profile && originPath && originPath.endsWith(".tsx")) {
				profile = TSX_PROFILE;
			}

			const request = {
				specifier: tc.specifier,
				intent: tc.intent || "dependency-edge",
				origin: originPath ? { path: originPath } : undefined,
				sourceFile: tc.sourceFile,
				sourceLanguage: tc.sourceLanguage || (originPath && originPath.endsWith(".php") ? "php" : undefined),
				syntaxKind: tc.syntaxKind,
				profile
			};

			const result = resolver.resolve(request);

			// Assertions
			assert.equal(result.status, tc.expectedStatus, `Expected status ${tc.expectedStatus}, got ${result.status}`);
			assert.equal(result.level, tc.expectedLevel, `Expected strategy level ${tc.expectedLevel}, got ${result.level}`);
			if (tc.expectedStrategy) {
				assert.equal(result.strategy, tc.expectedStrategy, `Expected strategy ${tc.expectedStrategy}, got ${result.strategy}`);
			}

			if (tc.expectedFile) {
				const expectedAbs = getFixtureFile(tc.fixture, tc.expectedFile);
				assert.equal(result.file, expectedAbs, `Expected file ${expectedAbs}, got ${result.file}`);
			}

			if (tc.expectedCandidates) {
				const expectedAbsList = tc.expectedCandidates.map(c => getFixtureFile(tc.fixture, c)).sort();
				const resultCandidatesSorted = (result.candidates || []).sort();
				assert.deepEqual(resultCandidatesSorted, expectedAbsList);
			}

			// Validate resolution start/complete debug events are emitted and carry context
			const events = debugCollector.getEvents();
			const reqEvent = events.find(e => e.category === "resolve:request");
			assert.ok(reqEvent);
			assert.equal(reqEvent.data.specifier, tc.specifier);
			assert.equal(reqEvent.data.intent, tc.intent || "dependency-edge");
			if (tc.sourceFile) assert.equal(reqEvent.data.sourceFile, tc.sourceFile);
			if (tc.sourceLanguage) assert.equal(reqEvent.data.sourceLanguage, tc.sourceLanguage);
			if (tc.syntaxKind) assert.equal(reqEvent.data.syntaxKind, tc.syntaxKind);

			const classifyEvent = events.find(e => e.category === "resolve:classify");
			assert.ok(classifyEvent);
			if (tc.sourceFile) assert.equal(classifyEvent.data.sourceFile, tc.sourceFile);
			if (tc.sourceLanguage) assert.equal(classifyEvent.data.sourceLanguage, tc.sourceLanguage);
			if (tc.syntaxKind) assert.equal(classifyEvent.data.syntaxKind, tc.syntaxKind);

			assert.ok(events.some(e => e.category === "resolve:complete"));
		});
	}
}

// --- Unit & Corner Case Tests for Phase 4J-A ---

const fs = require("node:fs");
const os = require("node:os");
const { stripJsonComments, parseTsConfig } = require("../dist/dependency/resolve/config-parser.js");
const { findNearestConfig } = require("../dist/dependency/resolve/strategies/tsconfig-paths.js");

test("4J-A Unit: stripJsonComments strips line and block comments and trailing commas", () => {
	const jsonc = `
	{
		// This is a line comment
		"compilerOptions": {
			"baseUrl": ".", /* block comment */
			"paths": {
				"@/*": ["src/*"], // trailing comma inside arrays/objects
			},
		}
	}
	`;
	const stripped = stripJsonComments(jsonc);
	const parsed = JSON.parse(stripped);
	assert.equal(parsed.compilerOptions.baseUrl, ".");
	assert.deepEqual(parsed.compilerOptions.paths["@/*"], ["src/*"]);

	const jsoncWeird = `{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"],
      "weird": ["literal,]", "literal,}"]
    }
  }
}`;
	const strippedWeird = stripJsonComments(jsoncWeird);
	const parsedWeird = JSON.parse(strippedWeird);
	assert.deepEqual(parsedWeird.compilerOptions.paths.weird, ["literal,]", "literal,}"]);
});

test("4J-A Unit: parseTsConfig correctly handles relative extends and overrides", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-tsconfig-"));
	try {
		const parentPath = path.join(root, "tsconfig.base.json");
		const childPath = path.join(root, "tsconfig.json");

		fs.writeFileSync(parentPath, JSON.stringify({
			compilerOptions: {
				baseUrl: "./base",
				paths: {
					"@/*": ["src/*"],
					"parent-only/*": ["parent/*"]
				}
			}
		}));

		fs.writeFileSync(childPath, JSON.stringify({
			extends: "./tsconfig.base.json",
			compilerOptions: {
				paths: {
					"@/*": ["child-src/*"]
				}
			}
		}));

		const parsed = parseTsConfig(childPath);
		// paths merged: child wins on @/*, parent inherited on parent-only/*
		assert.ok(parsed.paths["@/*"][0].includes("child-src"));
		assert.ok(parsed.paths["parent-only/*"][0].includes("parent"));
		// baseUrl inherited
		assert.ok(parsed.baseUrl.endsWith("base"));
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("4J-A Unit: parseTsConfig detects cycle in extends without crashing", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-tsconfig-cycle-"));
	try {
		const pathA = path.join(root, "tsconfig.a.json");
		const pathB = path.join(root, "tsconfig.b.json");

		fs.writeFileSync(pathA, JSON.stringify({ extends: "./tsconfig.b.json" }));
		fs.writeFileSync(pathB, JSON.stringify({ extends: "./tsconfig.a.json" }));

		assert.throws(() => {
			parseTsConfig(pathA);
		}, /Circular dependency/);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("4J-A Unit: findNearestConfig stops at index root and does not traverse higher", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-nearest-"));
	try {
		const srcDir = path.join(root, "src");
		fs.mkdirSync(srcDir, { recursive: true });

		// Put a tsconfig at the project root
		const projectConfig = path.join(root, "tsconfig.json");
		fs.writeFileSync(projectConfig, "{}");

		const index = await indexWorkspace(root);
		const nearest = findNearestConfig(path.join(srcDir, "main.ts").replace(/\\/g, "/"), index, "tsconfig.json");
		
		assert.equal(nearest, projectConfig.replace(/\\/g, "/"));
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("4J-A Unit: prodex.json aliases take precedence, resolve target, or report unresolved", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-aliases-precedence-"));
	try {
		const tsconfigPath = path.join(root, "tsconfig.json");
		const srcDir = path.join(root, "src");
		fs.mkdirSync(srcDir, { recursive: true });

		fs.writeFileSync(tsconfigPath, JSON.stringify({
			compilerOptions: {
				baseUrl: ".",
				paths: {
					"@/*": ["src/tsconfig-target/*"]
				}
			}
		}));

		fs.writeFileSync(path.join(srcDir, "helper.ts"), "export const a = 1;");

		const index = await indexWorkspace(root);
		const resolver = new UniversalResolver(index);

		// Resolve with prodex alias mapping @/* to src/*
		const requestWithProdex = {
			specifier: "@/helper",
			intent: "dependency-edge",
			origin: { path: path.join(srcDir, "main.ts").replace(/\\/g, "/") },
			aliases: {
				"@/*": "src/*"
			}
		};

		const res = resolver.resolve(requestWithProdex);
		// Since prodex.json takes precedence and resolves to src/helper.ts, it wins over tsconfig!
		assert.equal(res.status, "resolved");
		assert.equal(res.level, "L8");
		assert.equal(res.strategy, "prodex-alias");
		assert.equal(res.file, path.join(srcDir, "helper.ts").replace(/\\/g, "/"));

		// Resolve with non-existent prodex alias target -> reports unresolved directly at L8
		const requestUnresolved = {
			specifier: "@/non-existent",
			intent: "dependency-edge",
			origin: { path: path.join(srcDir, "main.ts").replace(/\\/g, "/") },
			aliases: {
				"@/*": "src/non-existent-dir/*"
			}
		};

		const resUnres = resolver.resolve(requestUnresolved);
		assert.equal(resUnres.status, "unresolved");
		assert.equal(resUnres.level, "L8");
		assert.equal(resUnres.strategy, "prodex-alias");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("4J-A Unit: most-specific path mapping wins in tsconfig", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-specific-"));
	try {
		const tsconfigPath = path.join(root, "tsconfig.json");
		const srcDir = path.join(root, "src");
		fs.mkdirSync(srcDir, { recursive: true });

		fs.writeFileSync(tsconfigPath, JSON.stringify({
			compilerOptions: {
				baseUrl: ".",
				paths: {
					"@/*": ["src/fallback/*"],
					"@components/*": ["src/components/*"]
				}
			}
		}));

		fs.mkdirSync(path.join(srcDir, "components"), { recursive: true });
		fs.writeFileSync(path.join(srcDir, "components/button.ts"), "export const b = 1;");

		const index = await indexWorkspace(root);
		const resolver = new UniversalResolver(index);

		const request = {
			specifier: "@components/button",
			intent: "dependency-edge",
			origin: { path: path.join(srcDir, "main.ts").replace(/\\/g, "/") }
		};

		const res = resolver.resolve(request);
		// Longest prefix match @components/* wins over @/* and resolves button.ts
		assert.equal(res.status, "resolved");
		assert.equal(res.level, "L8");
		assert.equal(res.strategy, "tsconfig-paths");
		assert.equal(res.file, path.join(srcDir, "components/button.ts").replace(/\\/g, "/"));
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("4J-A Unit: wildcard mapping tries targets in order", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-in-order-"));
	try {
		const tsconfigPath = path.join(root, "tsconfig.json");
		const srcDir = path.join(root, "src");
		fs.mkdirSync(srcDir, { recursive: true });

		fs.writeFileSync(tsconfigPath, JSON.stringify({
			compilerOptions: {
				baseUrl: ".",
				paths: {
					"@/*": ["src/first-dir/*", "src/second-dir/*"]
				}
			}
		}));

		// Place button.ts in second-dir only
		const secondDir = path.join(srcDir, "second-dir");
		fs.mkdirSync(secondDir, { recursive: true });
		fs.writeFileSync(path.join(secondDir, "button.ts"), "export const b = 1;");

		const index = await indexWorkspace(root);
		const resolver = new UniversalResolver(index);

		const request = {
			specifier: "@/button",
			intent: "dependency-edge",
			origin: { path: path.join(srcDir, "main.ts").replace(/\\/g, "/") }
		};

		const res = resolver.resolve(request);
		// Falls back to second-dir/* successfully and resolves
		assert.equal(res.status, "resolved");
		assert.equal(res.file, path.join(secondDir, "button.ts").replace(/\\/g, "/"));
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("4J-A Unit: jsconfig.json paths support JS projects", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-jsconfig-"));
	try {
		const jsconfigPath = path.join(root, "jsconfig.json");
		const srcDir = path.join(root, "src");
		fs.mkdirSync(srcDir, { recursive: true });

		fs.writeFileSync(jsconfigPath, JSON.stringify({
			compilerOptions: {
				baseUrl: ".",
				paths: {
					"@/*": ["src/*"]
				}
			}
		}));

		fs.writeFileSync(path.join(srcDir, "utils.js"), "module.exports = {};");

		const index = await indexWorkspace(root);
		const resolver = new UniversalResolver(index);

		const request = {
			specifier: "@/utils",
			intent: "dependency-edge",
			origin: { path: path.join(srcDir, "main.js").replace(/\\/g, "/") }
		};

		const res = resolver.resolve(request);
		assert.equal(res.status, "resolved");
		assert.equal(res.file, path.join(srcDir, "utils.js").replace(/\\/g, "/"));
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("4J-A Unit: alias target outside root is blocked", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "prodex-boundary-alias-"));
	try {
		const tsconfigPath = path.join(root, "tsconfig.json");
		const srcDir = path.join(root, "src");
		fs.mkdirSync(srcDir, { recursive: true });

		fs.writeFileSync(tsconfigPath, JSON.stringify({
			compilerOptions: {
				baseUrl: ".",
				paths: {
					"@/*": ["../outside-root/*"]
				}
			}
		}));

		const index = await indexWorkspace(root);
		const resolver = new UniversalResolver(index);

		const request = {
			specifier: "@/helper",
			intent: "dependency-edge",
			origin: { path: path.join(srcDir, "main.ts").replace(/\\/g, "/") }
		};

		const res = resolver.resolve(request);
		// Mapped outside workspace root boundary -> blocked
		assert.equal(res.status, "blocked");
		assert.equal(res.level, "L8");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

