import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { isExcluded } from "../tracing/exclude";
import { globScan } from "../filesystem/glob-scan";
import type { ExecutionPlan, SourceCollectionResult, ArtifactSection } from "../types";

export function isBinaryFile(filePath: string): boolean {
	try {
		const stat = fs.statSync(filePath);
		if (!stat.isFile()) return false;

		const fd = fs.openSync(filePath, "r");
		const buffer = Buffer.alloc(1024);
		const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
		fs.closeSync(fd);

		for (let i = 0; i < bytesRead; i++) {
			if (buffer[i] === 0) return true;
		}
		return false;
	} catch {
		return false;
	}
}

export function runGit(args: string[], cwd: string, warnings: string[], errors: string[], maxBuffer = 10 * 1024 * 1024): string {
	try {
		const res = spawnSync("git", args, {
			cwd,
			shell: false,
			encoding: "utf8",
			maxBuffer,
		});

		if (res.error) {
			const err: any = res.error;
			if (err.code === "ENOBUFS") {
				warnings.push("Git output exceeded limit and was truncated.");
				return (res.stdout || "").slice(0, maxBuffer);
			}
			if (err.code === "ENOENT") {
				errors.push("Git executable not found in PATH.");
			} else {
				errors.push(`Git command error: ${err.message || String(err)}`);
			}
			return "";
		}

		if (res.status !== 0) {
			errors.push(`Git command failed (exit code ${res.status}): ${res.stderr || "unknown error"}`);
			return "";
		}

		if (res.stderr) {
			warnings.push(`Git command stderr: ${res.stderr}`);
		}

		return res.stdout || "";
	} catch (err: any) {
		errors.push(`Git execution error: ${err.message || String(err)}`);
		return "";
	}
}

export async function collectGitSources(plan: ExecutionPlan): Promise<SourceCollectionResult> {
	const warnings: string[] = [];
	const errors: string[] = [];

	// 1. Verify if we are inside a Git repository and get the top level directory
	const isInside = runGit(["rev-parse", "--is-inside-work-tree"], plan.root, warnings, errors);
	if (errors.length) {
		return { files: [], entries: [], includes: plan.include ?? [], mode: "git", warnings, errors };
	}
	if (isInside.trim() !== "true") {
		errors.push("Not a git repository (or any of the parent directories).");
		return { files: [], entries: [], includes: plan.include ?? [], mode: "git", warnings, errors };
	}

	const gitRoot = runGit(["rev-parse", "--show-toplevel"], plan.root, warnings, errors).trim();
	if (errors.length || !gitRoot) {
		errors.push("Failed to resolve git top-level directory.");
		return { files: [], entries: [], includes: plan.include ?? [], mode: "git", warnings, errors };
	}

	// 2. Query git status --porcelain -z -uall relative to Git root
	const statusOut = runGit(["status", "--porcelain", "-z", "-uall"], gitRoot, warnings, errors);
	if (errors.length) {
		return { files: [], entries: [], includes: plan.include ?? [], mode: "git", warnings, errors };
	}

	// Determine active source options
	const gitOptions = plan.gitOptions || { changed: true, staged: true, unstaged: true, untracked: true };

	// 3. Parse porcelain entries
	const tokens = statusOut.split("\0");
	const gitSelectedPaths: string[] = [];
	const deletedList: string[] = [];
	const renamedList: { oldPath: string; newPath: string }[] = [];

	let i = 0;
	while (i < tokens.length) {
		const token = tokens[i];
		if (!token) {
			i++;
			continue;
		}

		const xy = token.slice(0, 2);
		const path1 = token.slice(3);
		const isRename = xy[0] === "R" || xy[0] === "C" || xy[1] === "R" || xy[1] === "C";

		let fileGitRel = "";
		let oldFileGitRel = "";

		if (isRename) {
			fileGitRel = path1; // new path / destination
			oldFileGitRel = tokens[i + 1] || ""; // old path / source
			i += 2;
		} else {
			fileGitRel = path1;
			i++;
		}

		if (!fileGitRel) continue;

		// Classify entry using X and Y status codes
		const X = xy[0];
		const Y = xy[1];

		const isUntracked = (X === "?" && Y === "?");
		const isStaged = !isUntracked && X !== " " && X !== "!" && X !== "?";
		const isUnstaged = !isUntracked && Y !== " " && Y !== "!" && Y !== "?";

		let isSelected = false;
		if (gitOptions.staged && isStaged) isSelected = true;
		if (gitOptions.unstaged && isUnstaged) isSelected = true;
		if (gitOptions.untracked && isUntracked) isSelected = true;

		if (isSelected) {
			const absolutePath = path.resolve(gitRoot, fileGitRel);
			gitSelectedPaths.push(absolutePath);

			if (X === "D" || Y === "D") {
				deletedList.push(absolutePath);
			}

			if (isRename) {
				const oldAbsolutePath = path.resolve(gitRoot, oldFileGitRel);
				renamedList.push({ oldPath: oldAbsolutePath, newPath: absolutePath });
			}
		}
	}

	// 4. Expand --include globs/files
	const includedPaths: string[] = [];
	if (plan.include && plan.include.length > 0) {
		const scan = await globScan(plan.include, { cwd: plan.root, absolute: true });
		includedPaths.push(...scan.files);
	}

	// 5. Merge and deduplicate
	const mergedPaths = [...new Set([...gitSelectedPaths, ...includedPaths])];

	// 6. Apply --exclude (exclude wins over both Git-selected and --include)
	const filteredPaths = mergedPaths.filter(p => !isExcluded(p, plan.exclude, plan.root));

	// 7. Classify final path set
	const finalFiles: string[] = [];
	const changesSummaryList: string[] = [];

	// Map paths back to plan-root-relative or just project relative for summary display
	const relPath = (p: string) => path.relative(plan.root, p).replaceAll("\\", "/");

	for (const p of filteredPaths) {
		const isDeleted = deletedList.includes(p) || !fs.existsSync(p);
		if (isDeleted) {
			changesSummaryList.push(`- Deleted: ${relPath(p)}`);
			continue;
		}

		const renameMatch = renamedList.find(r => r.newPath === p);
		if (renameMatch) {
			changesSummaryList.push(`- Renamed: ${relPath(renameMatch.oldPath)} -> ${relPath(renameMatch.newPath)}`);
		}

		if (isBinaryFile(p)) {
			changesSummaryList.push(`- Binary: ${relPath(p)}`);
			continue;
		}

		// It is a normal readable file or a readable file that might fail on snapshot
		finalFiles.push(p);
	}

	// Double check validation:
	// If no git selected files and no includes, fail clearly.
	const hasGitMatches = gitSelectedPaths.length > 0;
	const hasIncludes = plan.include && plan.include.length > 0;
	if (!hasGitMatches && !hasIncludes) {
		errors.push("No Git working-state files matched the active source flags and no include patterns were provided.");
		return { files: [], entries: [], includes: plan.include ?? [], mode: "git", warnings, errors };
	}

	// 8. Generate Git metadata sections
	const sections: ArtifactSection[] = [];

	// Git Status short
	const statusShort = runGit(["status", "--short"], plan.root, warnings, errors);
	sections.push({
		id: "git-status",
		title: "Git Status",
		kind: "code",
		language: "txt",
		content: statusShort || "(empty status)",
	});

	// Git Diff Stat
	const diffStat = runGit(["diff", "--stat"], plan.root, warnings, errors);
	sections.push({
		id: "git-diff-stat",
		title: "Git Diff Stat",
		kind: "code",
		language: "txt",
		content: diffStat || "(no diff stat)",
	});

	// Git Cached Diff Stat
	const diffCachedStat = runGit(["diff", "--cached", "--stat"], plan.root, warnings, errors);
	sections.push({
		id: "git-diff-cached-stat",
		title: "Git Cached Diff Stat",
		kind: "code",
		language: "txt",
		content: diffCachedStat || "(no cached diff stat)",
	});

	// File Notes
	if (changesSummaryList.length === 0) {
		changesSummaryList.push("(none)");
	}
	sections.push({
		id: "file-notes",
		title: "File Notes",
		kind: "text",
		content: changesSummaryList.join("\n"),
	});

	// Optional full diff sections
	if (gitOptions.includeDiff) {
		const diffText = runGit(["diff"], plan.root, warnings, errors, 5 * 1024 * 1024);
		sections.push({
			id: "full-diff",
			title: "Full Diff",
			kind: "code",
			language: "diff",
			content: diffText || "(no changes)",
		});

		const diffCachedText = runGit(["diff", "--cached"], plan.root, warnings, errors, 5 * 1024 * 1024);
		sections.push({
			id: "cached-full-diff",
			title: "Cached Full Diff",
			kind: "code",
			language: "diff",
			content: diffCachedText || "(no changes)",
		});
	}

	return {
		files: finalFiles,
		entries: [],
		includes: plan.include ?? [],
		mode: "git",
		warnings,
		errors,
		sections,
	};
}
