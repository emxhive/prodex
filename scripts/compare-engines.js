// @ts-nocheck
const path = require("node:path");
const fs = require("node:fs");

// Load universal dependency components
const { UniversalCaptureOrchestrator } = require("../dist/dependency/capture/orchestrator.js");
const { TreeSitterParserAdapter } = require("../dist/dependency/capture/adapter/tree-sitter/index.js");
const { JAVASCRIPT_CAPTURE_QUERY } = require("../dist/dependency/capture/adapter/tree-sitter/queries/javascript.js");
const { FileExtensionDetector } = require("../dist/dependency/capture/detect/detector.js");
const { DefaultParserRegistry } = require("../dist/dependency/capture/registry/registry.js");
const { DefaultCaptureQueryRegistry } = require("../dist/dependency/capture/query/registry.js");
const { indexWorkspace } = require("../dist/dependency/workspace/index.js");
const { UniversalResolver } = require("../dist/dependency/resolve/resolver.js");

// Load comparison helper
const { compareDirectory } = require("../test/support/comparison/compare-engines.js");

const WASM_PATH = path.resolve(__dirname, "../test/fixtures/tree-sitter/tree-sitter-javascript.wasm");

async function main() {
	const args = process.argv.slice(2);
	const targetDirArg = args[0] || ".";
	const targetDir = path.resolve(targetDirArg);

	if (!fs.existsSync(targetDir)) {
		console.error(`Target directory does not exist: ${targetDir}`);
		process.exit(1);
	}

	console.log(`Initializing Tree-sitter adapter from WASM: ${WASM_PATH}...`);
	const tsAdapter = await TreeSitterParserAdapter.create({
		javascript: WASM_PATH
	});

	// Setup detector, registry, orchestrator
	const detector = new FileExtensionDetector();
	const parserRegistry = new DefaultParserRegistry();
	const queryRegistry = new DefaultCaptureQueryRegistry();

	const jsProfile = {
		languageId: "javascript",
		extensions: [".js"],
		syntaxKinds: ["esm-import", "commonjs-require"],
		preferredAdapterId: "tree-sitter",
		bareBehavior: "external",
		extensionPriorityGroups: [[".js"], [".jsx"]],
		sourceEquivMap: {}
	};
	detector.registerProfile(jsProfile);
	parserRegistry.register(tsAdapter);
	queryRegistry.register(JAVASCRIPT_CAPTURE_QUERY);

	const orchestrator = new UniversalCaptureOrchestrator(detector, parserRegistry, queryRegistry);

	console.log(`Indexing target directory: ${targetDir}...`);
	const index = await indexWorkspace(targetDir, ["node_modules/**", "dist/**", "vendor/**", ".git/**"]);
	const resolver = new UniversalResolver(index);

	const cfg = {
		root: targetDir,
		exclude: ["**/node_modules/**", "**/dist/**", "**/vendor/**", "**/.git/**"],
		include: [],
		aliases: {}
	};

	console.log("Running Comparison Harness...");
	const reports = await compareDirectory(targetDir, cfg, orchestrator, resolver);

	// Tally overall file outcomes
	const fileCounts = {
		same: 0,
		"universal-only": 0,
		"legacy-only": 0,
		"different-target": 0,
		"both-unresolved": 0,
		"legacy-error": 0,
		"universal-error": 0
	};

	// Tally individual edge categories
	const edgeCounts = {
		same: 0,
		"universal-only": 0,
		"legacy-only": 0,
		"different-target": 0,
		"both-unresolved": 0,
		"legacy-error": 0,
		"universal-error": 0
	};

	const itemsWithDifferences = [];

	for (const report of reports) {
		fileCounts[report.category] = (fileCounts[report.category] || 0) + 1;
		if (report.category !== "same") {
			itemsWithDifferences.push(report);
		}

		if (report.category === "universal-error") {
			edgeCounts["universal-error"]++;
		} else if (report.category === "legacy-error") {
			edgeCounts["legacy-error"]++;
		}

		for (const edge of report.edges) {
			edgeCounts[edge.category]++;
		}
	}

	// Generate Report
	console.log("\n## Engine Comparison Report\n");
	console.log(`- **Target Directory**: \`${targetDir}\``);
	console.log(`- **Total JS Files Compared**: ${reports.length}\n`);

	console.log("### File Summary\n");
	console.log("| File Outcome | Count | Description |");
	console.log("|---|---|---|");
	console.log(`| **same** | ${fileCounts.same} | Perfect alignment between legacy and universal. |`);
	console.log(`| **universal-only** | ${fileCounts["universal-only"]} | File contains edges captured only by universal. |`);
	console.log(`| **legacy-only** | ${fileCounts["legacy-only"]} | File contains edges captured only by legacy. |`);
	console.log(`| **different-target** | ${fileCounts["different-target"]} | File contains targets resolving differently. |`);
	console.log(`| **both-unresolved** | ${fileCounts["both-unresolved"]} | File has only unresolved edges for both. |`);
	console.log(`| **legacy-error** | ${fileCounts["legacy-error"]} | Legacy parser/resolver failed with error. |`);
	console.log(`| **universal-error** | ${fileCounts["universal-error"]} | Universal parser/resolver failed with error. |`);
	console.log();

	console.log("### Edge Summary\n");
	console.log("| Edge Category | Count | Description |");
	console.log("|---|---|---|");
	console.log(`| **same** | ${edgeCounts.same} | Edges matching resolved targets. |`);
	console.log(`| **universal-only** | ${edgeCounts["universal-only"]} | Edges captured only by universal. |`);
	console.log(`| **legacy-only** | ${edgeCounts["legacy-only"]} | Edges captured only by legacy. |`);
	console.log(`| **different-target** | ${edgeCounts["different-target"]} | Edges resolving to different targets. |`);
	console.log(`| **both-unresolved** | ${edgeCounts["both-unresolved"]} | Edges unresolved in both engines. |`);
	console.log(`| **legacy-error** | ${edgeCounts["legacy-error"]} | Edges affected by legacy parser/resolver failures. |`);
	console.log(`| **universal-error** | ${edgeCounts["universal-error"]} | Edges affected by universal parser/resolver failures. |`);
	console.log();

	if (itemsWithDifferences.length > 0) {
		console.log("### Details of Differences\n");
		for (const item of itemsWithDifferences) {
			const relFile = path.relative(targetDir, item.filePath).replace(/\\/g, "/");
			console.log(`#### File: \`${relFile}\` (File Outcome: **${item.category}**)`);
			if (item.universalError) console.log(`- **Universal Error**: \`${item.universalError}\``);
			if (item.legacyError) console.log(`- **Legacy Error**: \`${item.legacyError}\``);

			const nonSameEdges = item.edges.filter(e => e.category !== "same");
			if (nonSameEdges.length > 0) {
				console.log("| Specifier | Legacy Captured | Universal Captured | Legacy Target | Universal Target | Status | Category |");
				console.log("|---|---|---|---|---|---|---|");
				for (const edge of nonSameEdges) {
					const lTarget = edge.legacyResolved ? path.relative(targetDir, edge.legacyResolved).replace(/\\/g, "/") : "null";
					const uTarget = edge.universalResolved ? path.relative(targetDir, edge.universalResolved).replace(/\\/g, "/") : "null";
					console.log(`| \`${edge.specifier}\` | ${edge.legacyCaptured} | ${edge.universalCaptured} | \`${lTarget}\` | \`${uTarget}\` | \`${edge.universalStatus || ""}\` | **${edge.category}** |`);
				}
				console.log();
			}
		}
	} else {
		console.log("### Verdict: PASS");
		console.log("Universal matches or improves on legacy for all tested dependency scenarios.");
	}

	const hasFailure = reports.some(report => {
		if (report.category === "different-target" || report.category === "legacy-only") {
			return true;
		}
		if (report.category === "universal-error") {
			// Expected syntax errors on test fixtures are not blocking failures
			if (report.universalError === "Document contains syntax errors") {
				return false;
			}
			return true;
		}
		return false;
	});

	if (hasFailure) {
		console.log("\n> [!WARNING]");
		console.log("> Gaps detected that must be resolved before full replacement.");
		process.exitCode = 1;
	} else {
		console.log("\n> [!NOTE]");
		console.log("> Ready to plan the JS-only production replacement path, subject to final review.");
		process.exitCode = 0;
	}
}

main().catch(err => {
	console.error("Comparison execution failed:", err);
	process.exit(1);
});
