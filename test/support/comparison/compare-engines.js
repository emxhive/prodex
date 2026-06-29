// @ts-nocheck
const path = require("node:path");
const fs = require("node:fs");

// Load production/legacy modules from the built dist
const { resolveJsImports } = require("../../../dist/legacy/resolvers/js/js-resolver");
const { extractImports } = require("../../../dist/legacy/resolvers/js/extract-imports");
const { resolveAliasPath } = require("../../../dist/legacy/resolvers/js/resolve-alias");
const { BASE_EXTS, DTS_EXT, REAL_EXTS } = require("../../../dist/legacy/resolvers/resolver-constants");
const { safeStatCached } = require("../../../dist/filesystem/stat-cache");
const { CACHE_KEYS } = require("../../../dist/cache/cache-keys");
const { edgesToRequests } = require("../../../dist/dependency/capture/bridge");

/**
 * Re-runs the exact legacy resolution candidate loop for a single specifier.
 * This utilizes the exact same constants, caches, and filesystem check function
 * that the production legacy resolver resolves imports with.
 */
async function resolveLegacySpecifier(imp, filePath, cfg) {
	if (!imp.startsWith(".") && !imp.startsWith("/") && !imp.startsWith("@")) {
		return null; // skipped / external
	}
	let base;
	if (imp.startsWith(".")) {
		base = path.resolve(path.dirname(filePath), imp);
	} else if (imp.startsWith("/")) {
		base = path.resolve(imp);
	} else {
		base = await resolveAliasPath(imp, cfg.root, cfg);
	}
	if (!base) return null;

	const absBase = path.resolve(base);
	const candidates = [];
	const ext = path.extname(absBase).toLowerCase();
	if (ext && REAL_EXTS.has(ext)) {
		candidates.push(absBase);
	} else {
		for (const candidateExt of [...BASE_EXTS, DTS_EXT]) {
			candidates.push(absBase + candidateExt);
			candidates.push(path.join(absBase, "index" + candidateExt));
		}
	}

	for (const candidate of candidates) {
		const abs = path.resolve(candidate);
		const stats = await safeStatCached(CACHE_KEYS.JS_STATS, abs);
		if (stats?.isFile()) {
			return abs;
		}
	}
	return null;
}

/**
 * Runs the real legacy resolution on a JS file and constructs a mapping
 * of raw specifier to resolved target file path.
 */
async function runLegacyPipeline(filePath, cfg) {
	try {
		// Run actual legacy JS resolver
		const legacyResult = await resolveJsImports({ cfg, filePath });

		// Extract raw specifiers using actual legacy logic
		let rawImports;
		try {
			rawImports = await extractImports(filePath, null);
		} catch {
			rawImports = new Set();
		}

		// Map specifiers to their resolved targets
		const edgeMapping = new Map();
		const mappedResolvedFiles = new Set();

		for (const imp of rawImports) {
			const resolvedPath = await resolveLegacySpecifier(imp, filePath, cfg);
			edgeMapping.set(imp, resolvedPath);
			if (resolvedPath) {
				mappedResolvedFiles.add(resolvedPath);
			}
		}

		// Self-verification mapping check to make sure our specifier mapping is consistent with resolver output
		const legacySet = new Set(legacyResult.files.map(f => path.resolve(f)));
		for (const f of mappedResolvedFiles) {
			const absF = path.resolve(f);
			if (!legacySet.has(absF)) {
				// Sibling/index ambiguity resolving differently, align with legacy result
				edgeMapping.set(f, null);
			}
		}

		return {
			rawImports,
			edgeMapping,
			legacyResult,
			error: null
		};
	} catch (err) {
		return {
			rawImports: new Set(),
			edgeMapping: new Map(),
			legacyResult: { files: [], stats: { expected: new Set(), resolved: new Set() } },
			error: err.message || String(err)
		};
	}
}

/**
 * Runs the universal capture and resolution pipeline for a single file.
 */
async function runUniversalPipeline(filePath, orchestrator, resolver) {
	try {
		const captureResult = orchestrator.capture(filePath);
		if (!captureResult) {
			return {
				edges: [],
				resolutions: new Map(),
				error: "Language not detected or supported"
			};
		}

		if (captureResult.parseError && !captureResult.edges.length) {
			return {
				edges: [],
				resolutions: new Map(),
				error: captureResult.parseError
			};
		}

		const requests = edgesToRequests(captureResult.edges);
		const resolutions = new Map();

		for (let i = 0; i < captureResult.edges.length; i++) {
			const edge = captureResult.edges[i];
			const req = requests[i];
			const res = resolver.resolve(req);
			resolutions.set(edge.specifier, res);
		}

		return {
			edges: captureResult.edges,
			resolutions,
			error: captureResult.parseError || null
		};
	} catch (err) {
		return {
			edges: [],
			resolutions: new Map(),
			error: err.message || String(err)
		};
	}
}

/**
 * Compares the legacy vs universal outcomes for a single file.
 */
async function compareJsFile(filePath, cfg, orchestrator, resolver) {
	const legacy = await runLegacyPipeline(filePath, cfg);
	const universal = await runUniversalPipeline(filePath, orchestrator, resolver);

	if (legacy.error) {
		return {
			filePath,
			legacyError: legacy.error,
			universalError: universal.error,
			edges: [],
			category: "legacy-error"
		};
	}

	if (universal.error && !universal.edges.length) {
		return {
			filePath,
			legacyError: null,
			universalError: universal.error,
			edges: [],
			category: "universal-error"
		};
	}

	// Gather all unique specifiers from both engines
	const allSpecifiers = new Set([
		...legacy.rawImports,
		...universal.edges.map(e => e.specifier)
	]);

	const edgeComparisons = [];
	for (const spec of allSpecifiers) {
		const legacyCaptured = legacy.rawImports.has(spec);
		const universalEdge = universal.edges.find(e => e.specifier === spec);
		const universalCaptured = !!universalEdge;

		let legacyResolved = undefined;
		if (legacyCaptured) {
			legacyResolved = legacy.edgeMapping.get(spec) || null;
		}

		let universalResolved = undefined;
		let universalStatus = undefined;
		if (universalCaptured) {
			const res = universal.resolutions.get(spec);
			if (res) {
				universalStatus = res.status;
				universalResolved = res.file || null;
			}
		}

		let category;
		if (legacyCaptured && !universalCaptured) {
			category = "legacy-only";
		} else if (!legacyCaptured && universalCaptured) {
			category = "universal-only";
		} else {
			const legacyIsExt = !spec.startsWith(".") && !spec.startsWith("/") && !spec.startsWith("@");
			const legacyUnresolved = legacyResolved === null;
			const universalIsExt = universalStatus === "external";
			const universalUnresolved = universalStatus === "unresolved" || universalStatus === "ambiguous";

			if (legacyIsExt && universalIsExt) {
				category = "same";
			} else if (legacyUnresolved && universalUnresolved) {
				category = "both-unresolved";
			} else if (legacyResolved && universalResolved && path.resolve(legacyResolved) === path.resolve(universalResolved)) {
				category = "same";
			} else {
				category = "different-target";
			}
		}

		edgeComparisons.push({
			specifier: spec,
			legacyCaptured,
			universalCaptured,
			legacyResolved,
			universalResolved,
			universalStatus,
			category
		});
	}

	let overallCategory = "same";
	if (universal.error) {
		overallCategory = "universal-error";
	} else if (edgeComparisons.some(e => e.category === "different-target")) {
		overallCategory = "different-target";
	} else if (edgeComparisons.some(e => e.category === "legacy-only")) {
		overallCategory = "legacy-only";
	} else if (edgeComparisons.some(e => e.category === "universal-only")) {
		overallCategory = "universal-only";
	} else if (edgeComparisons.some(e => e.category === "both-unresolved")) {
		overallCategory = "both-unresolved";
	}

	return {
		filePath,
		legacyError: null,
		universalError: universal.error,
		edges: edgeComparisons,
		category: overallCategory
	};
}

/**
 * Runs the comparison harness recursively across a directory for all .js files.
 */
async function compareDirectory(dirPath, cfg, orchestrator, resolver) {
	const reports = [];
	const files = [];

	async function walk(currentDir) {
		let entries;
		try {
			entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== ".git") {
					await walk(fullPath);
				}
			} else if (entry.isFile() && entry.name.endsWith(".js")) {
				files.push(fullPath);
			}
		}
	}

	await walk(dirPath);
	files.sort();

	for (const file of files) {
		const report = await compareJsFile(file, cfg, orchestrator, resolver);
		reports.push(report);
	}

	return reports;
}

module.exports = {
	compareJsFile,
	compareDirectory
};
