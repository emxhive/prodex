import fs from "node:fs";
import path from "node:path";
import { normalizePath } from "../../filesystem/path";
import { WorkspaceIndex } from "../workspace";
import { isDeniedDependencyPath } from "./vendor-deny";

export interface JsTsManifestInfo {
	path: string;
	root: string;
	name?: string;
	dependencyNames: Set<string>;
	readError?: string;
}

interface ManifestCacheEntry {
	loaded: boolean;
	manifests: JsTsManifestInfo[];
	readErrors: string[];
}

export class OwnershipManifestCache {
	private cache = new WeakMap<WorkspaceIndex, ManifestCacheEntry>();

	getJsTsManifests(index: WorkspaceIndex): JsTsManifestInfo[] {
		return this.load(index).manifests;
	}

	getReadErrors(index: WorkspaceIndex): string[] {
		return this.load(index).readErrors;
	}

	findLocalPackageByName(index: WorkspaceIndex, packageName: string): JsTsManifestInfo | undefined {
		return this.getJsTsManifests(index).find((manifest) => manifest.name === packageName);
	}

	findNearestManifestForSource(index: WorkspaceIndex, sourceFile?: string): JsTsManifestInfo | undefined {
		const manifests = this.getJsTsManifests(index);
		if (!manifests.length) return undefined;

		const normalizedSource = sourceFile
			? normalizePath(path.isAbsolute(sourceFile) ? sourceFile : path.resolve(index.root, sourceFile))
			: index.root;

		let best: JsTsManifestInfo | undefined;
		for (const manifest of manifests) {
			const rel = normalizePath(path.relative(manifest.root, normalizedSource));
			const isInside = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
			if (!isInside) continue;
			if (!best || manifest.root.length > best.root.length) {
				best = manifest;
			}
		}

		if (best) return best;

		const rootManifestPath = normalizePath(path.join(index.root, "package.json"));
		return manifests.find((manifest) => manifest.path === rootManifestPath);
	}

	clear(): void {
		this.cache = new WeakMap();
	}

	private load(index: WorkspaceIndex): ManifestCacheEntry {
		const cached = this.cache.get(index);
		if (cached?.loaded) return cached;

		const entry: ManifestCacheEntry = {
			loaded: true,
			manifests: [],
			readErrors: []
		};

		for (const info of index.filesByAbsolute.values()) {
			if (info.basename !== "package.json") continue;
			if (isDeniedDependencyPath(info.absolutePath, index.root)) continue;

			try {
				const raw = fs.readFileSync(info.absolutePath, "utf8");
				const parsed = JSON.parse(raw);
				entry.manifests.push({
					path: info.absolutePath,
					root: normalizePath(path.dirname(info.absolutePath)),
					name: typeof parsed.name === "string" ? parsed.name : undefined,
					dependencyNames: collectDependencyNames(parsed)
				});
			} catch (err: any) {
				entry.readErrors.push(`${info.absolutePath}: ${err.message || err}`);
			}
		}

		entry.manifests.sort((a, b) => a.root.localeCompare(b.root));
		this.cache.set(index, entry);
		return entry;
	}
}

function collectDependencyNames(parsed: any): Set<string> {
	const names = new Set<string>();
	for (const key of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
		const deps = parsed?.[key];
		if (!deps || typeof deps !== "object" || Array.isArray(deps)) continue;
		for (const name of Object.keys(deps)) {
			names.add(name);
		}
	}
	return names;
}
