import fs from "fs";
import path from "path";
import { globScan } from "../filesystem/glob-scan";
import { normalizePath } from "../filesystem/path";
import { unique } from "./trace-stats";
import type { ProdexConfig } from "../types";

export async function applyIncludes(cfg: ProdexConfig, files: string[]) {
	const { include, root } = cfg;
	const absoluteFiles: string[] = [];
	const patterns: string[] = [];

	for (const raw of include) {
		const candidate = String(raw ?? "").trim();
		if (!candidate) continue;

		const normalized = normalizePath(candidate);
		if (path.isAbsolute(normalized)) {
			try {
				if (fs.statSync(normalized).isFile()) {
					absoluteFiles.push(path.resolve(normalized));
					continue;
				}
			} catch {
				// Treat unreadable absolute paths as glob patterns so include handling stays consistent.
			}
		}

		patterns.push(normalized);
	}

	const scan = await globScan(patterns, { cwd: root });
	return unique([...files, ...absoluteFiles, ...scan.files]);
}
