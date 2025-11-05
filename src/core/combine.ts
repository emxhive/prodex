import { pickEntries } from "../cli/picker";
import { endSummary, entrySummary, introSummary } from "../cli/summary";
import { CACHE_KEYS } from "../constants/cache-keys";
import { CacheManager } from "./managers/cache";
import { ConfigManager } from "./managers/config-manager";
import { logger } from "../lib/logger";
import { CombineParams, ProdexConfig } from "../types";
import { applyIncludes, followChain } from "./dependency";
import { globScan } from "./helpers";
import { smartNaming } from "./helpers";
import { produceOutput } from "./output";

export async function runCombine({ cfg, opts }: CombineParams) {
	introSummary();

	const { showUi, cliName } = opts;
	let entries = (await resolveEntries(showUi, cfg)) ?? [];

	entrySummary(entries);

	let result;
	if (!entries.length) logger.info("No entries found");

	if (entries.length) result = await followChain(entries, cfg);

	const withinclude = await applyIncludes(cfg, result?.files ?? []);
	if (!withinclude.length) return logger.info("No Includes found. Exiting process...");

	const autoName = smartNaming(entries);
	const outputPath = await produceOutput({ name: cliName ?? autoName, files: withinclude, cfg, showUi });

	persistAliases();
	endSummary(outputPath, result);
}

async function resolveEntries(showUi: boolean, cfg: ProdexConfig): Promise<string[]> {
	const {
		root,
		entry: { files },
		resolve: { include },
	} = cfg;

	if (!showUi) {
		logger.info("CI Mode");
		if (!files?.length) {
			logger.warn("No entry files defined and UI mode is disabled.");
			if (!include.length) process.exit(1);
			logger.info("Applying Includes");
		}
		return (await globScan(files, { cwd: root })).files;
	} else {
		return await pickEntries(cfg);
	}
}

/**
 * 🧩 Persist discovered aliases (if any)
 */
function persistAliases() {
	const aliases = CacheManager.dump(CACHE_KEYS.ALIASES);
	if (Object.keys(aliases).length) {
		ConfigManager.persist({ resolve: { aliases } });
	}
}
