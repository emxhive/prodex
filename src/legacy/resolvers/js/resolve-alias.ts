import path from "path";
import type { ProdexConfig } from "../../../types";

export async function resolveAliasPath(specifier: string, root: string, cfg: ProdexConfig): Promise<string | null> {
	const knownAliases = cfg.aliases || {};
	const aliasKeys = Object.keys(knownAliases).sort((a, b) => b.length - a.length);

	for (const aliasKey of aliasKeys) {
		if (specifier === aliasKey) {
			return path.resolve(root, knownAliases[aliasKey]);
		}
		if (specifier.startsWith(aliasKey + "/")) {
			const remainder = specifier.slice(aliasKey.length + 1);
			return path.resolve(root, knownAliases[aliasKey], remainder);
		}
	}

	return null;
}
