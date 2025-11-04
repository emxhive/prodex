import { pickEntries } from "../cli/picker";
import { endSummary, entrySummary, introSummary } from "../cli/summary";
import { applyIncludes, followChain } from "./dependency";
import { smartNaming, globScan } from "./file-utils";
import { CombineParams, ProdexConfig } from "../types";
import { produceOutput } from "./output";
import { logger } from "../lib/logger";

export async function runCombine({ cfg, opts }: CombineParams) {
	introSummary();

	const { showUi, cliName } = opts;
	let entries = (await resolveEntries(showUi, cfg)) ?? [];

	entrySummary(entries);
	let result;

	if (entries.length) result = await followChain(entries, cfg);
	const withinclude = await applyIncludes(cfg, result?.files ?? []);
	const autoName = smartNaming(entries);
	const outputPath = await produceOutput({ name: cliName ?? autoName, files: withinclude, cfg, showUi });

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
