import fs from "fs";
import path from "path";
import { isExcluded } from "../tracing/exclude";
import {
	expandPathLike,
	discoverBySuffixPath,
	discoverByFullBasename,
	discoverBareName,
} from "../filesystem/entry-discovery";
import { isGlobPattern } from "../filesystem/path-patterns";
import type { ExecutionPlan } from "../types";

export interface TargetResolutionResult {
	entries: string[];
	warnings: string[];
	errors: string[];
}

export interface TargetClassification {
	isGlob: boolean;
	isPathLike: boolean;
	hasExt: boolean;
	basename: string;
	stem: string;
	normalizedTarget: string;
	normalizedBasename: string;
	normalizedSuffixPath: string;
	ext: string;
}

export function classifyTarget(target: string): TargetClassification {
	const isGlob = isGlobPattern(target);
	const isPathLike = target.includes("/") || target.includes("\\");
	const normalizedTarget = target.replaceAll("\\", "/");
	const ext = path.posix.extname(normalizedTarget);
	const hasExt = ext !== "";
	const basename = path.posix.basename(normalizedTarget);
	const stem = path.posix.basename(normalizedTarget, ext);

	const normalizedBasename = basename;
	const normalizedSuffixPath = normalizedTarget;

	return {
		isGlob,
		isPathLike,
		hasExt,
		basename,
		stem,
		normalizedTarget,
		normalizedBasename,
		normalizedSuffixPath,
		ext,
	};
}

export function formatAmbiguousTargetError(
	target: string,
	candidates: string[],
	root: string,
	reason?: "suffix" | "basename" | "stem-index"
): string {
	const formattedMatches = candidates
		.map((c) => `- ${path.relative(root, c).replaceAll("\\", "/")}`)
		.join("\n");

	let header = `Ambiguous target "${target}". Matches:\n`;
	if (reason === "suffix") {
		header = `Ambiguous target "${target}". Suffix matches:\n`;
	} else if (reason === "basename") {
		header = `Ambiguous target "${target}". Basename matches:\n`;
	}

	if (reason === "suffix" || reason === "basename") {
		return `${header}${formattedMatches}\n\nUse a more specific target.`;
	}

	const exampleCandidate = candidates[1] || candidates[0];
	const relativeCandidate = path.relative(root, exampleCandidate).replaceAll("\\", "/");
	const ext = path.extname(relativeCandidate);
	const suggestion = ext ? relativeCandidate.slice(0, -ext.length) : relativeCandidate;

	const targetStem = path.basename(target, path.extname(target));

	const uniqueExts = [...new Set(candidates.map((c) => path.extname(c).toLowerCase()))];
	const extensionsDiffer = uniqueExts.length > 1;
	const packExtension = extensionsDiffer ? ".*" : (uniqueExts[0] || ".ts");

	return `${header}${formattedMatches}\n\n` +
		`Use a more specific target, such as:\n` +
		`  prodex trace --target ${suggestion} --depth 2\n\n` +
		`If you intended to collect all matching files directly, use a glob with pack:\n` +
		`  prodex pack --entry "src/**/${targetStem}${packExtension}"`;
}

function processCandidates(
	candidates: string[],
	excludes: string[],
	root: string
): string[] {
	const nonExcluded = candidates
		.map((file) => path.resolve(root, file))
		.filter((file) => !isExcluded(file, excludes, root));
	return [...new Set(nonExcluded)];
}

export async function resolveTargets(plan: ExecutionPlan): Promise<TargetResolutionResult> {
	const resolved: string[] = [];
	const errors: string[] = [];
	const warnings: string[] = [];

	const root = plan.root;
	const excludes = plan.exclude;
	const targets = plan.target ?? [];

	for (const target of targets) {
		const classification = classifyTarget(target);

		// 1. Reject glob targets
		if (classification.isGlob) {
			errors.push(
				`Command "trace" does not accept glob targets.\n` +
				`Use \`prodex pack --entry <glob>\` to collect files directly.`
			);
			continue;
		}

		// 2. Exact root-relative lookup (auto-wins)
		const platformTarget = target.replaceAll("\\", path.sep).replaceAll("/", path.sep);
		const absPath = path.resolve(root, platformTarget);
		let isFile = false;
		try {
			isFile = fs.statSync(absPath).isFile();
		} catch {}
		if (isFile) {
			if (isExcluded(absPath, excludes, root)) {
				errors.push(`Target "${target}" exists but is excluded by the active exclude rules.`);
			} else {
				resolved.push(absPath);
			}
			continue;
		}

		let resolvedTarget = false;

		// 3. Extensionless root expansion
		if (!classification.hasExt) {
			const step3Matches = expandPathLike(target, root);
			const processed = processCandidates(step3Matches, excludes, root);
			if (processed.length === 1) {
				resolved.push(processed[0]);
				resolvedTarget = true;
			} else if (processed.length > 1) {
				errors.push(formatAmbiguousTargetError(target, processed, root, "stem-index"));
				resolvedTarget = true;
			}
		}
		if (resolvedTarget) continue;

		// 4. Suffix-path discovery for path-like targets
		if (classification.isPathLike) {
			// Try case-sensitive suffix discovery first
			let rawMatches = await discoverBySuffixPath(target, root, true, classification.hasExt);
			let processed = processCandidates(rawMatches, excludes, root);
			if (processed.length === 1) {
				resolved.push(processed[0]);
				resolvedTarget = true;
			} else if (processed.length > 1) {
				errors.push(formatAmbiguousTargetError(target, processed, root, "suffix"));
				resolvedTarget = true;
			}

			if (!resolvedTarget) {
				// Try case-insensitive suffix discovery fallback
				rawMatches = await discoverBySuffixPath(target, root, false, classification.hasExt);
				processed = processCandidates(rawMatches, excludes, root);
				if (processed.length === 1) {
					resolved.push(processed[0]);
					resolvedTarget = true;
				} else if (processed.length > 1) {
					errors.push(formatAmbiguousTargetError(target, processed, root, "suffix"));
					resolvedTarget = true;
				}
			}
		}
		if (resolvedTarget) continue;

		// 5. Full-basename discovery for extension-bearing bare targets
		if (!classification.isPathLike && classification.hasExt) {
			// Try case-sensitive full-basename discovery first
			let rawMatches = await discoverByFullBasename(target, root, true);
			let processed = processCandidates(rawMatches, excludes, root);
			if (processed.length === 1) {
				resolved.push(processed[0]);
				resolvedTarget = true;
			} else if (processed.length > 1) {
				errors.push(formatAmbiguousTargetError(target, processed, root, "basename"));
				resolvedTarget = true;
			}

			if (!resolvedTarget) {
				// Try case-insensitive full-basename discovery fallback
				rawMatches = await discoverByFullBasename(target, root, false);
				processed = processCandidates(rawMatches, excludes, root);
				if (processed.length === 1) {
					resolved.push(processed[0]);
					resolvedTarget = true;
				} else if (processed.length > 1) {
					errors.push(formatAmbiguousTargetError(target, processed, root, "basename"));
					resolvedTarget = true;
				}
			}
		}
		if (resolvedTarget) continue;

		// 6. Stem/index discovery for extensionless bare targets
		if (!classification.isPathLike && !classification.hasExt) {
			// Try case-sensitive stem/index discovery first
			let rawMatches = await discoverBareName(target, root, true);
			let processed = processCandidates(rawMatches, excludes, root);
			if (processed.length === 1) {
				resolved.push(processed[0]);
				resolvedTarget = true;
			} else if (processed.length > 1) {
				errors.push(formatAmbiguousTargetError(target, processed, root, "stem-index"));
				resolvedTarget = true;
			}

			if (!resolvedTarget) {
				// Try case-insensitive stem/index discovery fallback
				rawMatches = await discoverBareName(target, root, false);
				processed = processCandidates(rawMatches, excludes, root);
				if (processed.length === 1) {
					resolved.push(processed[0]);
					resolvedTarget = true;
				} else if (processed.length > 1) {
					errors.push(formatAmbiguousTargetError(target, processed, root, "stem-index"));
					resolvedTarget = true;
				}
			}
		}
		if (resolvedTarget) continue;

		// 7. Final not found error
		errors.push(`Target "${target}" did not match any files.`);
	}

	return {
		entries: [...new Set(resolved)],
		errors,
		warnings,
	};
}
