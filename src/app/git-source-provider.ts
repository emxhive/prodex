import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { isBinaryFile, isBinaryBuffer } from "../filesystem/binary";
import { buildFinalFileSet } from "../filesystem/file-set";
import { normalizePath } from "../filesystem/path";
import { isExcluded } from "../filesystem/exclude";
import type { ExecutionPlan, SourceCollectionResult, ArtifactSection, FileSnapshot } from "../types";
import { ProgressReporter, NoopProgressReporter } from "./progress";


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

export function runGitBuffer(args: string[], cwd: string, warnings: string[], errors: string[], maxBuffer = 10 * 1024 * 1024): Buffer | null {
	try {
		const res = spawnSync("git", args, {
			cwd,
			shell: false,
			encoding: "buffer",
			maxBuffer,
		});

		if (res.error) {
			const err: any = res.error;
			if (err.code === "ENOBUFS") {
				warnings.push("Git output exceeded limit and was truncated.");
				return (res.stdout || Buffer.alloc(0)).subarray(0, maxBuffer);
			}
			if (err.code === "ENOENT") {
				errors.push("Git executable not found in PATH.");
			} else {
				errors.push(`Git command error: ${err.message || String(err)}`);
			}
			return null;
		}

		if (res.status !== 0) {
			errors.push(`Git command failed (exit code ${res.status}): ${res.stderr ? res.stderr.toString("utf8") : "unknown error"}`);
			return null;
		}

		return res.stdout || Buffer.alloc(0);
	} catch (err: any) {
		errors.push(`Git execution error: ${err.message || String(err)}`);
		return null;
	}
}

function readHistoricalFile(
	rev: string,
	gitRelPath: string,
	gitRoot: string,
	warnings: string[],
	errors: string[]
): { content: string | null; isBinary: boolean; isDeleted: boolean } {
	const initialErrorCount = errors.length;
	const buf = runGitBuffer(["show", `${rev}:${gitRelPath}`], gitRoot, warnings, errors);
	if (errors.length > initialErrorCount) {
		const lastError = errors[errors.length - 1];
		if (
			lastError.includes("does not exist in") ||
			lastError.includes("exists on disk but not in") ||
			lastError.includes("Path '") ||
			lastError.includes("exists on disk, but not in")
		) {
			errors.splice(initialErrorCount); // clear new errors
			return { content: null, isBinary: false, isDeleted: true };
		}
		return { content: null, isBinary: false, isDeleted: false };
	}
	if (!buf) {
		return { content: null, isBinary: false, isDeleted: false };
	}

	const isBinary = isBinaryBuffer(buf);
	if (isBinary) {
		return { content: null, isBinary: true, isDeleted: false };
	}

	return { content: buf.toString("utf8"), isBinary: false, isDeleted: false };
}

function buildHistoricalSections(
	gitOptions: any,
	gitRoot: string,
	changesSummaryList: string[],
	warnings: string[],
	errors: string[]
): ArtifactSection[] {
	const sections: ArtifactSection[] = [];

	// 1. Git Mode section
	let modeContent = "";
	if (gitOptions.mode === "commit") {
		const commitInfo = runGit(["show", "-s", "--format=Revision: %H%nAuthor: %an <%ae>%nDate: %ad%nMessage: %s", gitOptions.rev], gitRoot, warnings, errors).trim();
		modeContent = `Mode:       commit\n${commitInfo || `Revision:   ${gitOptions.rev}`}`;
	} else if (gitOptions.mode === "range") {
		const baseSha = runGit(["rev-parse", gitOptions.base], gitRoot, warnings, errors).trim();
		const headSha = runGit(["rev-parse", gitOptions.head], gitRoot, warnings, errors).trim();
		modeContent = `Mode:       range\nSpec:       ${gitOptions.spec}\nBase SHA:   ${baseSha}\nHead SHA:   ${headSha}`;
	} else if (gitOptions.mode === "against") {
		const baseSha = runGit(["rev-parse", gitOptions.base], gitRoot, warnings, errors).trim();
		const headSha = runGit(["rev-parse", "HEAD"], gitRoot, warnings, errors).trim();
		modeContent = `Mode:       against\nAgainst:    ${gitOptions.base} (${baseSha})\nMerge Base: ${gitOptions.mergeBase}\nHEAD SHA:   ${headSha}`;
	}

	sections.push({
		id: "git-mode",
		title: "Git Mode",
		kind: "code",
		language: "txt",
		content: modeContent || "(unknown mode)",
	});

	// 2. Diff Stat section
	let statTitle = "Git Diff Stat";
	let statContent = "";
	if (gitOptions.mode === "commit") {
		statTitle = "Commit Diff Stat";
		statContent = runGit(["show", "--stat", "--oneline", gitOptions.rev], gitRoot, warnings, errors);
	} else if (gitOptions.mode === "range") {
		statTitle = "Range Diff Stat";
		statContent = runGit(["diff", "--stat", gitOptions.spec], gitRoot, warnings, errors);
	} else if (gitOptions.mode === "against") {
		statTitle = "Branch Diff Stat";
		statContent = runGit(["diff", "--stat", gitOptions.mergeBase, "HEAD"], gitRoot, warnings, errors);
	}

	sections.push({
		id: "git-diff-stat",
		title: statTitle,
		kind: "code",
		language: "txt",
		content: statContent || "(no diff stat)",
	});

	// 3. File Notes section
	const filteredSummary = [...changesSummaryList];
	if (filteredSummary.length === 0) {
		filteredSummary.push("(none)");
	}
	sections.push({
		id: "file-notes",
		title: "File Notes",
		kind: "text",
		content: filteredSummary.join("\n"),
	});

	// 4. Full Diff (when includeDiff is passed)
	if (gitOptions.includeDiff) {
		let fullDiffTitle = "Full Diff";
		let fullDiffContent = "";
		if (gitOptions.mode === "commit") {
			fullDiffTitle = "Commit Diff";
			fullDiffContent = runGit(["show", gitOptions.rev], gitRoot, warnings, errors, 5 * 1024 * 1024);
		} else if (gitOptions.mode === "range") {
			fullDiffTitle = "Range Diff";
			fullDiffContent = runGit(["diff", gitOptions.spec], gitRoot, warnings, errors, 5 * 1024 * 1024);
		} else if (gitOptions.mode === "against") {
			fullDiffTitle = "Branch Diff";
			fullDiffContent = runGit(["diff", gitOptions.mergeBase, "HEAD"], gitRoot, warnings, errors, 5 * 1024 * 1024);
		}

		sections.push({
			id: "full-diff",
			title: fullDiffTitle,
			kind: "code",
			language: "diff",
			content: fullDiffContent || "(no changes)",
		});
	}

	return sections;
}

async function collectHistoricalSources(
	plan: ExecutionPlan,
	gitOptions: Exclude<ExecutionPlan["gitOptions"], undefined> & { mode: "commit" | "range" | "against", mergeBase?: string },
	gitRoot: string,
	warnings: string[],
	errors: string[]
): Promise<SourceCollectionResult> {
	// 1. Resolve snapshot revision and file listing parameters
	let snapshotRev = "";
	let diffOut = "";

	if (gitOptions.mode === "commit") {
		// Verify commit exists
		const revParse = runGit(["rev-parse", "--verify", gitOptions.rev], gitRoot, warnings, errors).trim();
		if (errors.length || !revParse) {
			return { files: [], entries: [], includes: plan.include ?? [], mode: "git", warnings, errors };
		}
		snapshotRev = gitOptions.rev;
		// Run git diff-tree -M --root --no-commit-id -r --name-status -z <rev>
		diffOut = runGit(["diff-tree", "-M", "--root", "--no-commit-id", "-r", "--name-status", "-z", snapshotRev], gitRoot, warnings, errors);
	} else if (gitOptions.mode === "range") {
		// Warn if using three-dot range
		if (gitOptions.spec.includes("...")) {
			warnings.push(`Using three-dot range: comparing merge-base(${gitOptions.base}, ${gitOptions.head}) to ${gitOptions.head}.`);
		}
		// Verify endpoints
		const baseParse = runGit(["rev-parse", "--verify", gitOptions.base], gitRoot, warnings, errors).trim();
		const headParse = runGit(["rev-parse", "--verify", gitOptions.head], gitRoot, warnings, errors).trim();
		if (errors.length || !baseParse || !headParse) {
			return { files: [], entries: [], includes: plan.include ?? [], mode: "git", warnings, errors };
		}
		snapshotRev = gitOptions.head;
		// Run git diff -M --name-status -z <spec>
		diffOut = runGit(["diff", "-M", "--name-status", "-z", gitOptions.spec], gitRoot, warnings, errors);
	} else if (gitOptions.mode === "against") {
		// Resolve merge-base
		const mergeBase = runGit(["merge-base", gitOptions.base, "HEAD"], gitRoot, warnings, errors).trim();
		if (errors.length || !mergeBase) {
			errors.push(`Failed to find merge-base between ${gitOptions.base} and HEAD.`);
			return { files: [], entries: [], includes: plan.include ?? [], mode: "git", warnings, errors };
		}
		gitOptions.mergeBase = mergeBase;
		snapshotRev = "HEAD";
		// Run git diff -M --name-status -z <mergeBase> HEAD
		diffOut = runGit(["diff", "-M", "--name-status", "-z", mergeBase, "HEAD"], gitRoot, warnings, errors);
	}

	if (errors.length) {
		return { files: [], entries: [], includes: plan.include ?? [], mode: "git", warnings, errors };
	}

	// 2. Parse NUL-separated name-status output
	const tokens = diffOut.split("\0");
	const parsedFiles: { status: string; path: string; oldPath?: string }[] = [];
	let i = 0;
	while (i < tokens.length) {
		const status = tokens[i];
		if (!status) {
			i++;
			continue;
		}
		if (status.startsWith("R") || status.startsWith("C")) {
			const oldPath = tokens[i + 1];
			const newPath = tokens[i + 2];
			if (oldPath && newPath) {
				parsedFiles.push({ status, path: newPath, oldPath });
			}
			i += 3;
		} else {
			const filePath = tokens[i + 1];
			if (filePath) {
				parsedFiles.push({ status, path: filePath });
			}
			i += 2;
		}
	}

	// 3. Apply excludes to notes too! Consistent exclude filtering
	const filteredParsedFiles = parsedFiles.filter((file) => {
		const absPath = normalizePath(path.resolve(gitRoot, file.path));
		return !isExcluded(absPath, plan.exclude, plan.root);
	});

	// 4. Resolve file listing and snapshots
	const gitSelectedPaths: string[] = [];
	const snapshots: FileSnapshot[] = [];
	const changesSummaryList: string[] = [];
	const relPath = (p: string) => path.relative(plan.root, p).replaceAll("\\", "/");

	for (const file of filteredParsedFiles) {
		const absPath = normalizePath(path.resolve(gitRoot, file.path));
		const isDeleted = file.status.startsWith("D");

		if (isDeleted) {
			changesSummaryList.push(`- Deleted: ${relPath(absPath)}`);
			gitSelectedPaths.push(absPath);
			continue;
		}

		if (file.status.startsWith("R")) {
			const oldAbsPath = normalizePath(path.resolve(gitRoot, file.oldPath!));
			changesSummaryList.push(`- Renamed: ${relPath(oldAbsPath)} -> ${relPath(absPath)}`);
		} else if (file.status.startsWith("C")) {
			const oldAbsPath = normalizePath(path.resolve(gitRoot, file.oldPath!));
			changesSummaryList.push(`- Copied: ${relPath(oldAbsPath)} -> ${relPath(absPath)}`);
		}

		// Read content from git history
		const res = readHistoricalFile(snapshotRev, file.path, gitRoot, warnings, errors);
		if (res.isDeleted) {
			changesSummaryList.push(`- Deleted: ${relPath(absPath)}`);
			gitSelectedPaths.push(absPath);
			continue;
		}
		if (res.isBinary) {
			changesSummaryList.push(`- Binary: ${relPath(absPath)}`);
			gitSelectedPaths.push(absPath);
			continue;
		}

		if (res.content !== null) {
			gitSelectedPaths.push(absPath);
			snapshots.push({
				path: absPath,
				content: res.content,
			});
		} else {
			// readError
			gitSelectedPaths.push(absPath);
			snapshots.push({
				path: absPath,
				content: "",
				readError: "Failed to read file from Git history.",
			});
		}
	}

	// 5. Merge, resolve includes, apply excludes
	const filteredPaths = await buildFinalFileSet({
		root: plan.root,
		sources: gitSelectedPaths,
		include: plan.include ?? [],
		exclude: plan.exclude,
	});

	// 6. Classify final path set
	const finalFiles: string[] = [];
	for (const p of filteredPaths) {
		const isHistorical = gitSelectedPaths.includes(p);
		if (isHistorical) {
			const hasSnapshot = snapshots.some((s) => s.path === p);
			if (hasSnapshot) {
				finalFiles.push(p);
			}
			continue;
		}

		// Otherwise, it came from includes, so read from disk
		const isDeleted = !fs.existsSync(p);
		if (isDeleted) {
			changesSummaryList.push(`- Deleted: ${relPath(p)}`);
			continue;
		}

		if (isBinaryFile(p)) {
			changesSummaryList.push(`- Binary: ${relPath(p)}`);
			continue;
		}

		finalFiles.push(p);
	}

	// 7. Validation error for empty results
	const hasGitMatches = gitSelectedPaths.length > 0;
	const hasIncludes = plan.include && plan.include.length > 0;
	if (!hasGitMatches && !hasIncludes) {
		errors.push("No files matched the Git revision/range options and no include patterns were provided.");
		return { files: [], entries: [], includes: plan.include ?? [], mode: "git", warnings, errors };
	}

	// 8. Generate Git metadata sections (Commit 3)
	const sections = buildHistoricalSections(gitOptions, gitRoot, changesSummaryList, warnings, errors);

	return {
		files: finalFiles,
		entries: [],
		includes: plan.include ?? [],
		mode: "git",
		warnings,
		errors,
		sections,
		snapshots,
	};
}

export async function collectGitSources(
	plan: ExecutionPlan,
	progress: ProgressReporter = new NoopProgressReporter()
): Promise<SourceCollectionResult> {
	progress.update("collecting files");
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

	const gitOptions = (plan.gitOptions as any) || { mode: "working-tree" as const, changed: true, staged: true, unstaged: true, untracked: true, includeDiff: false };

	if (gitOptions.mode !== "working-tree" && gitOptions.mode !== undefined) {
		return collectHistoricalSources(plan, gitOptions as any, gitRoot, warnings, errors);
	}

	// 2. Query git status --porcelain -z -uall relative to Git root
	const statusOut = runGit(["status", "--porcelain", "-z", "-uall"], gitRoot, warnings, errors);
	if (errors.length) {
		return { files: [], entries: [], includes: plan.include ?? [], mode: "git", warnings, errors };
	}

	// Determine active source options (already parsed above as working-tree)


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
			const absolutePath = normalizePath(path.resolve(gitRoot, fileGitRel));
			gitSelectedPaths.push(absolutePath);

			if (X === "D" || Y === "D") {
				deletedList.push(absolutePath);
			}

			if (isRename) {
				const oldAbsolutePath = normalizePath(path.resolve(gitRoot, oldFileGitRel));
				renamedList.push({ oldPath: oldAbsolutePath, newPath: absolutePath });
			}
		}
	}

	// 4. Merge, resolve includes, apply excludes, and sort deterministically
	const filteredPaths = await buildFinalFileSet({
		root: plan.root,
		sources: gitSelectedPaths,
		include: plan.include ?? [],
		exclude: plan.exclude,
	});

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
