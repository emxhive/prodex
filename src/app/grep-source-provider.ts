import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { buildFinalFileSet } from "../filesystem/file-set";
import { normalizePath } from "../filesystem/path";
import type { ExecutionPlan, SourceCollectionResult, ArtifactSection } from "../types";

export async function collectGrepSources(plan: ExecutionPlan): Promise<SourceCollectionResult> {
	const warnings: string[] = [];
	const errors: string[] = [];

	const opts = plan.grepOptions;
	if (!opts) {
		errors.push("Missing grep options in execution plan.");
		return { files: [], entries: [], includes: plan.include ?? [], mode: "grep", warnings, errors };
	}

	// 1. Build ripgrep arguments
	const args = ["--json"];

	if (opts.mode === "regex") {
		args.push("-e", opts.terms[0]);
	} else {
		// query, any, all mode use fixed-strings
		args.push("-F");
		if (opts.mode === "all") {
			// Search for the first term with ripgrep, we will filter the rest in JS
			args.push("-e", opts.terms[0]);
		} else {
			// query (one term) or any (multiple terms in OR search)
			for (const term of opts.terms) {
				args.push("-e", term);
			}
		}
	}

	// Add within path boundaries
	for (const w of opts.within) {
		const absPath = path.isAbsolute(w) ? w : path.resolve(plan.root, w);
		const relPath = path.relative(plan.root, absPath).replace(/\\/g, "/");
		args.push("-g", relPath);
	}

	// Add skip path boundaries
	for (const s of opts.skip) {
		const absPath = path.isAbsolute(s) ? s : path.resolve(plan.root, s);
		const relPath = path.relative(plan.root, absPath).replace(/\\/g, "/");
		args.push("-g", `!${relPath}`);
	}

	// Target the current directory explicitly to avoid ripgrep default behavior of reading stdin
	args.push(".");

	// 2. Execute ripgrep
	const res = spawnSync("rg", args, {
		cwd: plan.root,
		encoding: "utf8",
		maxBuffer: 10 * 1024 * 1024,
	});

	if (res.error) {
		if ((res.error as any).code === "ENOENT") {
			errors.push('Command "grep" requires ripgrep (`rg`) to be installed.');
		} else {
			errors.push(`Ripgrep execution error: ${res.error.message}`);
		}
		return { files: [], entries: [], includes: plan.include ?? [], mode: "grep", warnings, errors };
	}

	const matchedFilesSet = new Set<string>();
	const matchCounts = new Map<string, number>();

	if (res.status === 0 && res.stdout) {
		const lines = res.stdout.split("\n");
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			try {
				const msg = JSON.parse(trimmed);
				if (msg.type === "match") {
					const relPath = msg.data?.path?.text;
					if (relPath) {
						const absPath = normalizePath(path.resolve(plan.root, relPath));
						matchedFilesSet.add(absPath);
						matchCounts.set(absPath, (matchCounts.get(absPath) || 0) + 1);
					}
				}
			} catch {
				// Ignore non-json or malformed output lines
			}
		}
	} else if (res.status !== 0 && res.status !== 1) {
		errors.push(`Ripgrep error (exit code ${res.status}): ${res.stderr || "unknown error"}`);
		return { files: [], entries: [], includes: plan.include ?? [], mode: "grep", warnings, errors };
	}

	let matchedFiles = Array.from(matchedFilesSet);

	// 3. Filter for AND search (mode === "all")
	if (opts.mode === "all" && opts.terms.length > 1) {
		const remainingTerms = opts.terms.slice(1);
		const filteredMatchedFiles: string[] = [];
		for (const file of matchedFiles) {
			try {
				if (fs.existsSync(file)) {
					const content = fs.readFileSync(file, "utf8");
					const matchesAll = remainingTerms.every((term) => content.includes(term));
					if (matchesAll) {
						filteredMatchedFiles.push(file);
					} else {
						matchCounts.delete(file);
					}
				}
			} catch (err: any) {
				warnings.push(`Failed to read file content for filtering: ${file}. Error: ${err.message}`);
			}
		}
		matchedFiles = filteredMatchedFiles;
	}

	// 4. Apply --not content filter
	if (opts.negativeTerms.length > 0) {
		const filteredMatchedFiles: string[] = [];
		for (const file of matchedFiles) {
			try {
				if (fs.existsSync(file)) {
					const content = fs.readFileSync(file, "utf8");
					const hasNegative = opts.negativeTerms.some((neg) => content.includes(neg));
					if (!hasNegative) {
						filteredMatchedFiles.push(file);
					} else {
						matchCounts.delete(file);
					}
				}
			} catch (err: any) {
				warnings.push(`Failed to read file content for negative filtering: ${file}. Error: ${err.message}`);
			}
		}
		matchedFiles = filteredMatchedFiles;
	}

	// 5. Sort matched files deterministically by normalized root-relative path
	matchedFiles.sort((a, b) => {
		const relA = normalizePath(path.relative(plan.root, a));
		const relB = normalizePath(path.relative(plan.root, b));
		return relA.localeCompare(relB);
	});

	const matchedCountBeforeLimit = matchedFiles.length;

	// 6. Apply --max-files limit to matched files
	const resolvedMaxFiles = plan.maxFiles;
	let maxFilesApplied = false;
	if (resolvedMaxFiles !== undefined && resolvedMaxFiles !== null && matchedFiles.length > resolvedMaxFiles) {
		matchedFiles = matchedFiles.slice(0, resolvedMaxFiles);
		maxFilesApplied = true;
	}

	// 7. Add --include and apply --exclude through buildFinalFileSet
	const finalFiles = await buildFinalFileSet({
		root: plan.root,
		sources: matchedFiles,
		include: plan.include ?? [],
		exclude: plan.exclude ?? [],
	});

	// 8. No-match behavior validation
	const hasMatchedFiles = matchedCountBeforeLimit > 0;
	const hasIncludes = plan.include && plan.include.length > 0;

	if (!hasMatchedFiles && !hasIncludes) {
		errors.push("No files matched grep search.");
		return { files: [], entries: [], includes: plan.include ?? [], mode: "grep", warnings, errors };
	}

	if (!hasMatchedFiles && hasIncludes) {
		warnings.push("No files matched grep search.");
	}

	// 9. Generate metadata sections
	const sections: ArtifactSection[] = [];

	const formatList = (list: string[]) => (list.length > 0 ? list.map((item) => `\`${item}\``).join(", ") : "(none)");

	let queryTermsDesc = "";
	if (opts.mode === "regex") {
		queryTermsDesc = `\`${opts.terms[0]}\` (regex)`;
	} else if (opts.mode === "query") {
		queryTermsDesc = `\`${opts.terms[0]}\``;
	} else {
		queryTermsDesc = opts.terms.map((t) => `\`${t}\``).join(", ");
	}

	const summaryContent = [
		`- **Search Mode**: ${opts.mode}`,
		`- **Query/Terms/Pattern**: ${queryTermsDesc}`,
		`- **Within Boundaries**: ${formatList(opts.within)}`,
		`- **Skip Boundaries**: ${formatList(opts.skip)}`,
		`- **Negative Filters**: ${formatList(opts.negativeTerms)}`,
		`- **Matched File Count (before includes & limits)**: ${matchedCountBeforeLimit}`,
		`- **Max Files Limit**: ${resolvedMaxFiles ?? "(none)"}${maxFilesApplied ? " (applied)" : ""}`,
		`- **Final File Count (after includes/excludes)**: ${finalFiles.length}`,
	].join("\n");

	sections.push({
		id: "grep-summary",
		title: "Grep Summary",
		kind: "text",
		content: summaryContent,
	});

	const finalFileSet = new Set(finalFiles);
	const finalMatchedFiles = matchedFiles.filter((file) => finalFileSet.has(file));

	const matchesContentList: string[] = [];
	for (const file of finalMatchedFiles) {
		const rel = path.relative(plan.root, file).replace(/\\/g, "/");
		const count = matchCounts.get(file) || 0;
		const countText = count === 1 ? "1 matching line" : `${count} matching lines`;
		matchesContentList.push(`- ${rel} (${countText})`);
	}

	sections.push({
		id: "grep-matches",
		title: "Grep Matches",
		kind: "text",
		content: matchesContentList.length > 0 ? matchesContentList.join("\n") : "(no content matches)",
	});

	return {
		files: finalFiles,
		entries: [],
		includes: plan.include ?? [],
		mode: "grep",
		warnings,
		errors,
		sections,
	};
}
