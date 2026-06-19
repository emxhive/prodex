const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { globScan } = require("../dist/filesystem/glob-scan.js");
const { DEFAULT_PRODEX_CONFIG } = require("../dist/config/default-config.js");
const { resolveAliasPath } = require("../dist/resolvers/js/resolve-alias.js");
const { resolvePsr4 } = require("../dist/resolvers/php/psr4.js");
const { resolvePhpImports } = require("../dist/resolvers/php/php-resolver.js");
const { loadLaravelBindings } = require("../dist/resolvers/php/bindings.js");
const { loadConfig, validateConfig } = require("../dist/config/load.js");
const { migrateConfig } = require("../dist/config/migration/transform.js");

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

test("globScan does not hard-ignore paths like node_modules, vendor, dist", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "node_modules/foo.ts"), "export const foo = 1;");
		writeFile(path.join(root, "dist/bar.ts"), "export const bar = 1;");
		writeFile(path.join(root, "src/index.ts"), "export const index = 1;");

		// globScan without ignores will scan node_modules and dist now
		const { files } = await globScan(["**/*.ts"], { cwd: root });
		const relativeFiles = files.map(f => path.relative(root, f).replaceAll("\\", "/")).sort();

		assert.ok(relativeFiles.includes("node_modules/foo.ts"));
		assert.ok(relativeFiles.includes("dist/bar.ts"));
		assert.ok(relativeFiles.includes("src/index.ts"));
	});
});

test("DEFAULT_PRODEX_CONFIG no longer excludes shadcn components or UI", () => {
	const excludes = DEFAULT_PRODEX_CONFIG.exclude || [];
	assert.ok(!excludes.includes("@shadcn/**"));
	assert.ok(!excludes.includes("**/components/ui/**"));
	// Broader noise exclusions remain
	assert.ok(excludes.includes("node_modules/**"));
	assert.ok(excludes.includes("vendor/**"));
	assert.ok(excludes.includes("dist/**"));
});

test("JS alias resolution strict standard matching rules", async () => {
	const config = {
		aliases: {
			"@": "src",
			"@components": "src/components",
			"~shared": "src/shared"
		}
	};

	// 1. Exact match
	const matchExact = await resolveAliasPath("@", "/root", config);
	assert.equal(matchExact, path.resolve("/root", "src"));

	// 2. Prefix match
	const matchPrefix = await resolveAliasPath("@/utils/format", "/root", config);
	assert.equal(matchPrefix, path.resolve("/root", "src/utils/format"));

	// 3. Descending length sorting check (matches @components instead of @)
	const matchLongest = await resolveAliasPath("@components/Button", "/root", config);
	assert.equal(matchLongest, path.resolve("/root", "src/components/Button"));

	// 4. Ignored package/scoped npm package imports
	const matchScopedPkg = await resolveAliasPath("@tanstack/react-query", "/root", config);
	assert.equal(matchScopedPkg, null);

	const matchScopePkg = await resolveAliasPath("@scope/pkg", "/root", config);
	assert.equal(matchScopePkg, null);

	// 5. Resolves only if configured
	const matchUnconfigured = await resolveAliasPath("~unconfigured/foo", "/root", config);
	assert.equal(matchUnconfigured, null);
});

test("PHP resolver supports composer PSR-4 arrays of directories", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "composer.json"), {
			autoload: {
				"psr-4": {
					"App\\": ["src/App1", "src/App2"]
				}
			}
		});

		const psr4 = resolvePsr4(root);
		assert.deepEqual(psr4["App"], [
			path.resolve(root, "src/App1"),
			path.resolve(root, "src/App2")
		]);

		// Setup target files in different PSR-4 directories
		writeFile(path.join(root, "src/App1/Models/User.php"), "<?php namespace App\\Models; class User {}");
		writeFile(path.join(root, "src/App2/Services/Payment.php"), "<?php namespace App\\Services; class Payment {}");

		const phpCtx = {
			kind: "php",
			psr4,
			nsKeys: ["App"],
			bindings: {}
		};

		// Test resolving files under different directories in same namespace
		const resolver = require("../dist/resolvers/php/php-resolver.js");
		
		// Setup index.php to import User and Payment
		writeFile(path.join(root, "src/index.php"), `<?php
			use App\\Models\\User;
			use App\\Services\\Payment;
		`);

		const result = await resolvePhpImports({
			cfg: { root, aliases: {}, depth: 10, maxFiles: 200, exclude: [] },
			filePath: path.join(root, "src/index.php"),
			ctx: phpCtx
		});

		const resolvedFiles = result.files.map(f => path.relative(root, f).replaceAll("\\", "/")).sort();
		assert.deepEqual(resolvedFiles, [
			"src/App1/Models/User.php",
			"src/App2/Services/Payment.php"
		]);
	});
});

test("PHP resolver proper PSR-4 boundary matching", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "composer.json"), {
			autoload: {
				"psr-4": {
					"App\\": "src/App",
					"AppStore\\": "src/AppStore"
				}
			}
		});

		const psr4 = resolvePsr4(root);
		assert.equal(psr4["App"], path.resolve(root, "src/App"));
		assert.equal(psr4["AppStore"], path.resolve(root, "src/AppStore"));

		writeFile(path.join(root, "src/AppStore/Models/Gift.php"), "<?php namespace AppStore\\Models; class Gift {}");
		writeFile(path.join(root, "src/App/Models/User.php"), "<?php namespace App\\Models; class User {}");

		const phpCtx = {
			kind: "php",
			psr4,
			nsKeys: ["AppStore", "App"].sort((a, b) => b.length - a.length),
			bindings: {}
		};

		// index imports AppStore\Models\Gift and App\Models\User
		// Verify AppStore doesn't falsely fall back/match into App
		writeFile(path.join(root, "src/index.php"), `<?php
			use AppStore\\Models\\Gift;
			use App\\Models\\User;
		`);

		const result = await resolvePhpImports({
			cfg: { root, aliases: {}, depth: 10, maxFiles: 200, exclude: [] },
			filePath: path.join(root, "src/index.php"),
			ctx: phpCtx
		});

		const resolvedFiles = result.files.map(f => path.relative(root, f).replaceAll("\\", "/")).sort();
		assert.deepEqual(resolvedFiles, [
			"src/App/Models/User.php",
			"src/AppStore/Models/Gift.php"
		]);
	});
});

test("PHP resolver local use alias, grouped imports, and references resolution", async () => {
	await usingTempProjectAsync(async (root) => {
		writeJson(path.join(root, "composer.json"), {
			autoload: {
				"psr-4": {
					"App\\": "src/App"
				}
			}
		});

		const psr4 = resolvePsr4(root);
		writeFile(path.join(root, "src/App/Models/User.php"), "<?php namespace App\\Models; class User {}");
		writeFile(path.join(root, "src/App/Models/Team.php"), "<?php namespace App\\Models; class Team {}");
		writeFile(path.join(root, "src/App/Services/PaymentService.php"), "<?php namespace App\\Services; class PaymentService {}");
		writeFile(path.join(root, "src/App/Controllers/Post.php"), "<?php namespace App\\Controllers; class Post {}");

		const phpCtx = {
			kind: "php",
			psr4,
			nsKeys: ["App"],
			bindings: {}
		};

		writeFile(path.join(root, "src/index.php"), `<?php
			namespace App\\Controllers;

			use App\\Models\\{User, Team};
			use App\\Services\\PaymentService as Payment;

			class OrderController {
				public function store(Post $post) {
					$u = new User();
					$p = new Payment();
					$t = Team::class;
				}
			}
		`);

		const result = await resolvePhpImports({
			cfg: { root, aliases: {}, depth: 10, maxFiles: 200, exclude: [] },
			filePath: path.join(root, "src/index.php"),
			ctx: phpCtx
		});

		const resolvedFiles = result.files.map(f => path.relative(root, f).replaceAll("\\", "/")).sort();
		assert.deepEqual(resolvedFiles, [
			"src/App/Controllers/Post.php", // resolved relative to currentNamespace App\Controllers
			"src/App/Models/Team.php", // resolved from grouped imports
			"src/App/Models/User.php", // resolved from grouped imports
			"src/App/Services/PaymentService.php" // resolved from use alias 'Payment'
		]);
	});
});

test("PHP resolver Laravel bindings FQCN and leading backslashes", async () => {
	await usingTempProjectAsync(async (root) => {
		writeFile(path.join(root, "app/Providers/AppServiceProvider.php"), `<?php
			namespace App\\Providers;
			class AppServiceProvider {
				public function register() {
					$this->app->bind(\\App\\Contracts\\PaymentInterface::class, \\App\\Services\\StripeService::class);
					$this->app->singleton(App\\Contracts\\AuthInterface::class, App\\Services\\JwtAuthService::class);
				}
			}
		`);

		const bindings = loadLaravelBindings(root);
		assert.equal(bindings["App\\Contracts\\PaymentInterface"], "App\\Services\\StripeService");
		assert.equal(bindings["App\\Contracts\\AuthInterface"], "App\\Services\\JwtAuthService");
	});
});

test("loadConfig deep clones defaults and rejects future versions", async () => {
	await usingTempProjectAsync(async (root) => {
		// 1. Future config version
		writeJson(path.join(root, "prodex.json"), {
			version: 6,
			$schema: "schema"
		});

		const resFuture = loadConfig(root);
		assert.equal(resFuture.errors.length, 1);
		assert.match(resFuture.errors[0], /future config version 6/);

		// 2. Deep clone check: mutating returned default should not affect subsequent loads
		fs.rmSync(path.join(root, "prodex.json"));
		const resDefault1 = loadConfig(root);
		resDefault1.config.depth = 999;

		const resDefault2 = loadConfig(root);
		assert.notEqual(resDefault2.config.depth, 999);
	});
});

test("validateConfig shape validation checks", () => {
	// Valid v5
	const valid = {
		version: 5,
		$schema: "schema",
		output: {
			dir: "prodex",
			versioned: true,
			format: "md"
		},
		exclude: ["node_modules/**"],
		aliases: { "@": "src" },
		depth: 3,
		scopes: {
			dashboard: {
				name: "dash",
				entry: ["src/index.ts"]
			}
		}
	};
	assert.equal(validateConfig(valid).length, 0);

	// Invalid version
	assert.ok(validateConfig({ version: 4 }).length > 0);

	// Unknown root keys
	assert.ok(validateConfig({ version: 5, unknownKey: "oops" }).length > 0);

	// Invalid output format
	assert.ok(validateConfig({ version: 5, output: { format: "pdf" } }).length > 0);

	// Invalid scope keys
	assert.ok(validateConfig({
		version: 5,
		scopes: {
			dashboard: {
				invalidKey: "wat"
			}
		}
	}).length > 0);
});

test("migrateConfig output sanitization prevents leakage", () => {
	const legacyInput = {
		version: 3,
		output: {
			dir: "out",
			format: "txt",
			unknownField: "leak"
		}
	};

	const migration = migrateConfig(legacyInput);
	assert.equal(migration.config.output.unknownField, undefined);
	assert.equal(migration.config.output.dir, "out");
	assert.equal(migration.config.output.format, "txt");
});
