import fs from "fs/promises";
import path from "path";
import { normalizePath } from "../../filesystem/path";
import { isExcluded } from "../../filesystem/exclude";
import { ResolutionDebugEvent } from "../debug/types";

export interface FileInfo {
	absolutePath: string;
	relativePath: string;
	normalizedRelativePath: string;
	directory: string;
	basename: string;
	stem: string;
	extension: string;
}

export interface DirectoryEntry {
	absolutePath: string;
	relativePath: string;
	files: string[];
	directories: string[];
}

export interface WorkspaceIndex {
	root: string;
	filesByAbsolute: Map<string, FileInfo>;
	filesByRelative: Map<string, FileInfo>;
	directories: Map<string, DirectoryEntry>;
	filesByBasename: Map<string, string[]>;
	filesByStem: Map<string, string[]>;
	filesByExtension: Map<string, string[]>;
	extensionsPresent: Set<string>;
}

export class WorkspaceIndexer {
	static async index(
		root: string,
		exclude: string[] = [],
		debugCallback?: (event: ResolutionDebugEvent) => void
	): Promise<WorkspaceIndex> {
		debugCallback?.({
			category: "workspace:index:start",
			timestamp: Date.now(),
			data: { root, exclude },
			message: `Starting workspace index for root: ${root}`
		});

		const normRoot = normalizePath(path.resolve(root));
		const filesByAbsolute = new Map<string, FileInfo>();
		const filesByRelative = new Map<string, FileInfo>();
		const directories = new Map<string, DirectoryEntry>();
		const filesByBasename = new Map<string, string[]>();
		const filesByStem = new Map<string, string[]>();
		const filesByExtension = new Map<string, string[]>();
		const extensionsPresent = new Set<string>();

		const allFiles: string[] = [];

		// Helper to check if directory should be skipped
		const isDirExcluded = (dirPath: string): boolean => {
			if (isExcluded(dirPath, exclude, normRoot)) return true;
			const dummyChild = path.join(dirPath, "dummy_child_file_for_exclude_check.txt");
			return isExcluded(dummyChild, exclude, normRoot);
		};

		// Recursive crawler
		const crawl = async (dir: string): Promise<void> => {
			const normDir = normalizePath(dir);
			let entries: any[] = [];
			try {
				entries = await fs.readdir(normDir, { withFileTypes: true });
			} catch (err) {
				return;
			}

			const immediateFiles: string[] = [];
			const immediateDirs: string[] = [];

			for (const entry of entries) {
				const fullPath = normalizePath(path.join(normDir, entry.name));

				if (entry.isDirectory()) {
					if (isDirExcluded(fullPath)) {
						continue;
					}
					immediateDirs.push(fullPath);
				} else if (entry.isFile()) {
					if (isExcluded(fullPath, exclude, normRoot)) {
						continue;
					}
					immediateFiles.push(fullPath);
					allFiles.push(fullPath);
				}
			}

			directories.set(normDir, {
				absolutePath: normDir,
				relativePath: normalizePath(path.relative(normRoot, normDir)),
				files: immediateFiles.sort(),
				directories: immediateDirs.sort()
			});

			for (const subDir of immediateDirs) {
				await crawl(subDir);
			}
		};

		// Start crawl if root exists
		try {
			const stat = await fs.stat(normRoot);
			if (stat.isDirectory()) {
				await crawl(normRoot);
			}
		} catch (err) {
			// root doesn't exist or is not readable
		}

		// Sort all crawled files for determinism
		allFiles.sort();

		// Populate maps
		for (const file of allFiles) {
			const absolutePath = file;
			const relativePath = path.relative(normRoot, file);
			const normalizedRelativePath = normalizePath(relativePath);
			const directory = normalizePath(path.dirname(absolutePath));
			const basename = path.basename(absolutePath);
			const extension = path.extname(absolutePath);
			const stem = path.basename(absolutePath, extension);

			const info: FileInfo = {
				absolutePath,
				relativePath,
				normalizedRelativePath,
				directory,
				basename,
				stem,
				extension
			};

			filesByAbsolute.set(absolutePath, info);
			filesByRelative.set(normalizedRelativePath, info);

			// Basename
			let basenameList = filesByBasename.get(basename);
			if (!basenameList) {
				basenameList = [];
				filesByBasename.set(basename, basenameList);
			}
			basenameList.push(absolutePath);

			// Stem
			let stemList = filesByStem.get(stem);
			if (!stemList) {
				stemList = [];
				filesByStem.set(stem, stemList);
			}
			stemList.push(absolutePath);

			// Extension
			if (extension) {
				let extList = filesByExtension.get(extension);
				if (!extList) {
					extList = [];
					filesByExtension.set(extension, extList);
				}
				extList.push(absolutePath);
				extensionsPresent.add(extension);
			}
		}

		debugCallback?.({
			category: "workspace:index:complete",
			timestamp: Date.now(),
			data: {
				fileCount: filesByAbsolute.size,
				dirCount: directories.size,
				extensions: Array.from(extensionsPresent)
			},
			message: `Workspace index complete. Found ${filesByAbsolute.size} files, ${directories.size} directories, and ${extensionsPresent.size} unique extensions.`
		});

		return {
			root: normRoot,
			filesByAbsolute,
			filesByRelative,
			directories,
			filesByBasename,
			filesByStem,
			filesByExtension,
			extensionsPresent
		};
	}
}

export async function indexWorkspace(
	root: string,
	exclude: string[] = [],
	debugCallback?: (event: ResolutionDebugEvent) => void
): Promise<WorkspaceIndex> {
	return WorkspaceIndexer.index(root, exclude, debugCallback);
}
