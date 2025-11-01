import { pickEntries } from "../cli/picker";
import { endSummary, entrySummary } from "../cli/summary";
import { applyincludes, followChain } from "./dependency";
import { produceSmartName, globScan } from "./file-utils";
import { logger } from "../lib/logger";
import { CombineParams, ProdexConfig } from "../types";
import { produceOutput } from "./output";

export async function runCombine({ cfg, opts }: CombineParams) {
	const { showUi, cliName } = opts;

	let entries = (await resolveEntries(showUi, cfg)) ?? [];

	if (!entries.length) {
		logger.error("No entries selected.");
		return;
	}

	entrySummary(entries);

	
	const result = await followChain(entries, cfg);
	const withinclude = await applyincludes(cfg, result.files);

	const autoName = produceSmartName(entries);

	const outputPath = await produceOutput({ name: cliName ?? autoName, files: withinclude, cfg, showUi });

	endSummary(outputPath, result);
}

async function resolveEntries(showUi: boolean, cfg: ProdexConfig): Promise<string[]> {
	const { root, entry } = cfg;
	const { files } = entry;

	if (!showUi) {
		logger.info("CI Mode");
		if (!files?.length) {
			logger.warn("No entry files defined and UI mode is disabled.");
			process.exit(1);
		}
		return (await globScan(files, { cwd: root })).files;
	} else {
		
		return await pickEntries(cfg);
	}
}
