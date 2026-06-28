const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { indexWorkspace } = require("../dist/dependency/workspace/index.js");
const { UniversalResolver } = require("../dist/dependency/resolve/resolver.js");
const { DebugCollector } = require("../dist/dependency/debug/collector.js");

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
		specifier: "@/helper",
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
		name: "L8: TS path alias rewrite (planned)",
		fixture: "profile-rewrites",
		specifier: "@/helper",
		intent: "dependency-edge",
		origin: "src/main.ts",
		state: "planned",
		expectedStatus: "resolved",
		expectedLevel: "L8"
	},
	{
		name: "L9: TypeScript NodeNext .js -> .ts mapping (planned)",
		fixture: "nodenext-runtime-specifiers",
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
		state: "planned",
		expectedStatus: "resolved",
		expectedLevel: "L10"
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

			const request = {
				specifier: tc.specifier,
				intent: tc.intent || "dependency-edge",
				origin: originPath ? { path: originPath } : undefined,
				sourceFile: tc.sourceFile,
				sourceLanguage: tc.sourceLanguage,
				syntaxKind: tc.syntaxKind
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
