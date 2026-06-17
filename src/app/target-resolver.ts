import fs from "fs";
import path from "path";
import { isExcluded } from "../tracing/exclude";
import { expandPathLike, discoverBareName } from "../filesystem/entry-discovery";
import { isGlobPattern } from "../filesystem/path-patterns";
import type { ExecutionPlan } from "../types";

export interface TargetResolutionResult {
	entries: string[];
	warnings: string[];
	errors: string[];
}

// runBareNameDiscovery consolidated into discoverBareName from entry-discovery

function formatAmbiguousTargetError(target: string, candidates: string[], root: string): string {
	const formattedMatches = candidates
		.map((c) => `- ${path.relative(root, c).replaceAll("\\", "/")}`)
		.join("\n");

	const exampleCandidate = candidates[1] || candidates[0];
	const relativeCandidate = path.relative(root, exampleCandidate).replaceAll("\\", "/");
	const ext = path.extname(relativeCandidate);
	const suggestion = ext ? relativeCandidate.slice(0, -ext.length) : relativeCandidate;

	const targetStem = path.basename(target, path.extname(target));
	
	const uniqueExts = [...new Set(candidates.map((c) => path.extname(c).toLowerCase()))];
	const extensionsDiffer = uniqueExts.length > 1;
	const packExtension = extensionsDiffer ? ".*" : (uniqueExts[0] || ".ts");

	return `Ambiguous target "${target}". Matches:\n` +
		`${formattedMatches}\n\n` +
		`Use a more specific target, such as:\n` +
		`  prodex trace --target ${suggestion} --depth 2\n\n` +
		`If you intended to collect all matching files directly, use a glob with pack:\n` +
		`  prodex pack --entry "src/**/${targetStem}${packExtension}"`;
}

export async function resolveTargets(plan: ExecutionPlan): Promise<TargetResolutionResult> {
	const resolved: string[] = [];
	const errors: string[] = [];
	const warnings: string[] = [];

	const root = plan.root;
	const excludes = plan.exclude;
	const targets = plan.target ?? [];

	for (const target of targets) {
		if (isGlobPattern(target)) {
			errors.push(
				`Command "trace" does not accept glob targets.\n` +
				`Use \`prodex pack --entry <glob>\` to collect files directly.`
			);
			continue;
		}

		// 1. Exact path match
		const absPath = path.resolve(root, target);
		let isFile = false;
		try {
			isFile = fs.statSync(absPath).isFile();
		} catch {}
		if (isFile) {
			if (!isExcluded(absPath, excludes, root)) {
				resolved.push(absPath);
			}
			continue;
		}

		// 2. Extensionless path expansion
		const hasExt = path.extname(target) !== "";
		if (!hasExt) {
			const step2Matches = expandPathLike(target, root);
			const step2NonExcluded = step2Matches.filter((file) => !isExcluded(file, excludes, root));
			if (step2NonExcluded.length > 0) {
				if (step2NonExcluded.length === 1) {
					resolved.push(step2NonExcluded[0]);
				} else {
					errors.push(formatAmbiguousTargetError(target, step2NonExcluded, root));
				}
				continue;
			}
		}

		// 3. Bare-name discovery
		const isPathLike = target.includes("/") || target.includes("\\");
		if (!isPathLike) {
			const step3Matches = await discoverBareName(target, root, true);
			const step3NonExcluded = step3Matches.filter((file) => !isExcluded(file, excludes, root));
			if (step3NonExcluded.length > 0) {
				if (step3NonExcluded.length === 1) {
					resolved.push(step3NonExcluded[0]);
				} else {
					errors.push(formatAmbiguousTargetError(target, step3NonExcluded, root));
				}
				continue;
			}
		}

		// 4. Case-insensitive bare-name discovery
		if (!isPathLike) {
			const step4Matches = await discoverBareName(target, root, false);
			const step4NonExcluded = step4Matches.filter((file) => !isExcluded(file, excludes, root));
			if (step4NonExcluded.length > 0) {
				if (step4NonExcluded.length === 1) {
					resolved.push(step4NonExcluded[0]);
				} else {
					errors.push(formatAmbiguousTargetError(target, step4NonExcluded, root));
				}
				continue;
			}
		}

		// Fail clearly if no matches found
		errors.push(`Target "${target}" did not match any files.`);
	}

	return {
		entries: [...new Set(resolved)],
		errors,
		warnings,
	};
}
