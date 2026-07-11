import path from "node:path";
import { ResolutionRequest } from "../../request/types";
import { SpecifierClassification } from "../classify";
import { StrategyOutcome } from "../types";
import { WorkspaceIndex } from "../../workspace";
import { normalizePath } from "../../../filesystem/path";
import { DebugCollector } from "../../debug/collector";
import { Psr4Reader } from "../psr4-reader";
import { createPhpPsr4Ownership } from "../../ownership/ecosystems/php";
import { createPolicyDeniedOwnership, getDeniedDependencyPathMatch, isDeniedDependencyPath } from "../../ownership/vendor-deny";

export function resolvePhpNamespace(
	request: ResolutionRequest,
	classification: SpecifierClassification,
	index: WorkspaceIndex,
	debugCollector?: DebugCollector
): StrategyOutcome {
	// Only activate for php profile + bare classification
	if (request.profile?.languageId !== "php" || classification.type !== "bare") {
		return { type: "no-decision", reason: "Not a PHP namespace request." };
	}

	const specifier = classification.specifier;
	const psr4Metadata = Psr4Reader.readWithMetadata(index.root);
	const psr4 = psr4Metadata.map;

	// Find the longest matching prefix
	const matchingNsKey = Object.keys(psr4)
		.sort((a, b) => b.length - a.length)
		.find((candidate) => {
			return specifier === candidate || specifier.startsWith(candidate + "\\");
		});

	if (!matchingNsKey) {
		return { type: "no-decision", reason: `No PSR-4 namespace prefix matches specifier: ${specifier}` };
	}

	const relativeImport = specifier.slice(matchingNsKey.length).replace(/^\\+/, "");
	const relativeImportPath = relativeImport.replace(/\\/g, "/");

	const mappedDirs = psr4[matchingNsKey];
	const dirs = (Array.isArray(mappedDirs) ? mappedDirs : [mappedDirs]).map((dir) => normalizePath(dir));
	const safeDirs = dirs.filter((dir) => isInsideRoot(dir, index.root) && !isDeniedDependencyPath(dir, index.root));

	if (safeDirs.length === 0) {
		const denied = dirs
			.map((dir) => getDeniedDependencyPathMatch(dir, index.root))
			.find(Boolean);
		if (denied) {
			const ownership = createPolicyDeniedOwnership({
				specifier: request.specifier,
				ecosystem: "php",
				sourceFile: request.sourceFile,
				deniedPath: denied.path,
				segment: denied.segment,
				specifierRoot: matchingNsKey.endsWith("\\") ? matchingNsKey : `${matchingNsKey}\\`
			});
			const result = {
				status: "unresolved" as const,
				level: "L10" as const,
				strategy: "php-namespace",
				reason: ownership.message,
				ownership
			};
			debugCollector?.emit("resolve:strategy:complete", { strategy: "L10", request, result }, `L10 PHP namespace denied by policy: ${specifier}`);
			return { type: "final", result };
		}

		return { type: "no-decision", reason: `PSR-4 namespace prefix matched but no safe mapped directories are inside the workspace root: ${specifier}` };
	}

	const candidates: string[] = [];
	for (const dir of safeDirs) {
		candidates.push(
			normalizePath(path.join(dir, relativeImportPath)),
			normalizePath(path.join(dir, relativeImportPath + ".php")),
			normalizePath(path.join(dir, relativeImportPath, "index.php"))
		);
	}

	// Look up candidates in index
	const resolvedPath = candidates.find((cand) => index.filesByAbsolute.has(cand));

	if (resolvedPath) {
		const ownership = createPhpPsr4Ownership({
			specifier: request.specifier,
			sourceFile: request.sourceFile,
			composerPath: psr4Metadata.composerPath,
			matchedPrefix: matchingNsKey,
			mappedDirs: safeDirs,
			resolvedFile: resolvedPath
		});
		const result = {
			status: "resolved" as const,
			level: "L10" as const,
			strategy: "php-namespace",
			confidence: "high" as const,
			file: resolvedPath,
			files: [resolvedPath],
			ownership
		};
		debugCollector?.emit("resolve:strategy:complete", { strategy: "L10", request, result }, `L10 Resolved PHP namespace: ${resolvedPath}`);
		return { type: "final", result };
	}

	// File was not found but prefix matched -> unresolved with diagnostic
	const ownership = createPhpPsr4Ownership({
		specifier: request.specifier,
		sourceFile: request.sourceFile,
		composerPath: psr4Metadata.composerPath,
		matchedPrefix: matchingNsKey,
		mappedDirs: safeDirs
	});
	const result = {
		status: "unresolved" as const,
		level: "L10" as const,
		strategy: "php-namespace",
		reason: `PHP namespace resolved to expected path but file not found. Candidates tried: ${candidates.join(", ")}`,
		ownership
	};
	debugCollector?.emit("resolve:strategy:complete", { strategy: "L10", request, result }, `L10 PHP namespace unresolved: ${specifier}`);
	return { type: "final", result };
}

function isInsideRoot(candidate: string, root: string): boolean {
	const relative = normalizePath(path.relative(indexRoot(root), normalizePath(candidate)));
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function indexRoot(root: string): string {
	return normalizePath(path.resolve(root));
}
