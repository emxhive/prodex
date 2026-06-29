import path from "node:path";
import { ResolutionRequest } from "../../request/types";
import { SpecifierClassification } from "../classify";
import { StrategyOutcome } from "../types";
import { WorkspaceIndex } from "../../workspace";
import { normalizePath } from "../../../filesystem/path";
import { DebugCollector } from "../../debug/collector";
import { Psr4Reader } from "../psr4-reader";

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
	const psr4 = Psr4Reader.read(index.root);

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
	const dirs = Array.isArray(mappedDirs) ? mappedDirs : [mappedDirs];

	const candidates: string[] = [];
	for (const dir of dirs) {
		candidates.push(
			normalizePath(path.join(dir, relativeImportPath)),
			normalizePath(path.join(dir, relativeImportPath + ".php")),
			normalizePath(path.join(dir, relativeImportPath, "index.php"))
		);
	}

	// Look up candidates in index
	const resolvedPath = candidates.find((cand) => index.filesByAbsolute.has(cand));

	if (resolvedPath) {
		const result = {
			status: "resolved" as const,
			level: "L10" as const,
			strategy: "php-namespace",
			confidence: "high" as const,
			file: resolvedPath,
			files: [resolvedPath]
		};
		debugCollector?.emit("resolve:strategy:complete", { strategy: "L10", request, result }, `L10 Resolved PHP namespace: ${resolvedPath}`);
		return { type: "final", result };
	}

	// File was not found but prefix matched -> unresolved with diagnostic
	const result = {
		status: "unresolved" as const,
		level: "L10" as const,
		strategy: "php-namespace",
		reason: `PHP namespace resolved to expected path but file not found. Candidates tried: ${candidates.join(", ")}`
	};
	debugCollector?.emit("resolve:strategy:complete", { strategy: "L10", request, result }, `L10 PHP namespace unresolved: ${specifier}`);
	return { type: "final", result };
}
