import micromatch from "micromatch";
import path from "path";
import { normalizePath } from "./path";

export function isExcluded(p: string, patterns: string[] = [], root: string = process.cwd()): boolean {
	if (!patterns?.length) return false;
	if (!p) return false;

	const normAbsolute = normalizePath(path.resolve(root, p));
	const normRelative = normalizePath(path.relative(root, normAbsolute));

	for (const pattern of patterns) {
		const normPattern = normalizePath(pattern);
		if (path.isAbsolute(normPattern)) {
			if (micromatch.isMatch(normAbsolute, normPattern)) {
				return true;
			}
		} else {
			if (micromatch.isMatch(normRelative, normPattern)) {
				return true;
			}
		}
	}

	return false;
}
