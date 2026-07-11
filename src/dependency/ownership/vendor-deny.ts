import path from "node:path";
import { normalizePath } from "../../filesystem/path";
import { DependencyOwnershipResult } from "./types";

export const DEFAULT_DENIED_DEPENDENCY_SEGMENTS = new Set([
	"node_modules",
	"vendor",
	".venv",
	"venv",
	"site-packages",
	"__pycache__",
	"target",
	".dart_tool",
	"Pods",
	"bin/Debug",
	"bin/Release",
	"obj/Debug",
	"obj/Release"
]);

const DENIED_SEGMENT_SEQUENCES = Array.from(DEFAULT_DENIED_DEPENDENCY_SEGMENTS).map((value) => value.split("/"));

export interface DeniedPathMatch {
	path: string;
	segment: string;
}

export function getDeniedDependencyPathMatch(filePath: string, root?: string): DeniedPathMatch | undefined {
	const normalizedPath = normalizePath(path.resolve(filePath));
	let segmentSource = normalizedPath;

	if (root) {
		const normalizedRoot = normalizePath(path.resolve(root));
		const relative = normalizePath(path.relative(normalizedRoot, normalizedPath));
		if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
			segmentSource = relative;
		}
	}

	const segments = segmentSource.split("/").filter(Boolean);
	for (let index = 0; index < segments.length; index++) {
		for (const sequence of DENIED_SEGMENT_SEQUENCES) {
			if (matchesAt(segments, sequence, index)) {
				return {
					path: normalizedPath,
					segment: sequence.join("/")
				};
			}
		}
	}

	return undefined;
}

export function isDeniedDependencyPath(filePath: string, root?: string): boolean {
	return !!getDeniedDependencyPathMatch(filePath, root);
}

export function createPolicyDeniedOwnership(params: {
	specifier: string;
	ecosystem?: string;
	sourceFile?: string;
	deniedPath: string;
	segment: string;
	specifierRoot?: string;
}): DependencyOwnershipResult {
	return {
		kind: "unresolved",
		reason: "policy-denied",
		ecosystem: params.ecosystem ?? "unknown",
		specifier: params.specifier,
		specifierRoot: params.specifierRoot,
		sourceFile: params.sourceFile,
		evidence: {
			deniedPath: params.deniedPath,
			segment: params.segment
		},
		message: `Dependency path "${params.deniedPath}" is denied by trace-safety policy segment "${params.segment}".`
	};
}

function matchesAt(segments: string[], sequence: string[], index: number): boolean {
	if (index + sequence.length > segments.length) return false;
	for (let offset = 0; offset < sequence.length; offset++) {
		if (segments[index + offset] !== sequence[offset]) return false;
	}
	return true;
}
