import { normalizePath } from "../../../filesystem/path";
import { DependencyOwnershipResult } from "../types";

export function createPhpPsr4Ownership(params: {
	specifier: string;
	sourceFile?: string;
	composerPath: string;
	matchedPrefix: string;
	mappedDirs: string[];
	resolvedFile?: string;
}): DependencyOwnershipResult {
	const specifierRoot = params.matchedPrefix.endsWith("\\")
		? params.matchedPrefix
		: `${params.matchedPrefix}\\`;
	const mappedDirs = params.mappedDirs.map((dir) => normalizePath(dir));
	const resolvedFile = params.resolvedFile ? normalizePath(params.resolvedFile) : undefined;

	return {
		kind: "local",
		reason: "project-owned",
		ecosystem: "php",
		specifier: params.specifier,
		specifierRoot,
		sourceFile: params.sourceFile,
		evidence: {
			composerPath: normalizePath(params.composerPath),
			matchedPrefix: specifierRoot,
			mappedDirs,
			resolvedFile
		},
		message: resolvedFile
			? `PHP namespace "${params.specifier}" is project-owned by PSR-4 prefix "${specifierRoot}" and resolves to "${resolvedFile}".`
			: `PHP namespace "${params.specifier}" is project-owned by PSR-4 prefix "${specifierRoot}", but no matching file was found.`
	};
}
