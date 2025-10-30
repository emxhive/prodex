import fs from "fs";
import inquirer from "inquirer";
import path from "path";
import { pickEntries } from "../cli/picker";
import { importSummary, showSummary } from "../cli/summary";
import { loadProdexConfig } from "../constants/config-loader";
import "../lib/polyfills";
import { applyIncludes, followChain } from "./dependency";
import { generateOutputName, globScan, resolveOutDirPath } from "./file-utils";
import { renderMd, renderTxt, tocMd, tocTxt } from "./renderers";
import { logger } from "../lib/logger";
import { ProdexConfig } from "../types";

export async function runCombine(cfg: ProdexConfig, showUi: boolean) {
	const { output, entry, resolve } = cfg;
	const toMd = cfg.output.format == "md";
	const ROOT = cfg.root;
	const { ui } = entry;
	const entryFiles = entry.files ?? [];

	let entries = [];

	if (!showUi) {
    logger.info("CI Mode")
		if (!entryFiles.length) {
			logger.warn("No entry files defined and UI mode is disabled.");
			return;
		}
		entries = (await globScan(entryFiles, { cwd: ROOT })).files;
	} else {
		entries = await pickEntries(ui.roots, ui.scanDepth, cfg);
	}

	if (!entries.length) {
		logger.error("No entries selected.");
		return;
	}

	logger.log("\n📋 You selected:");
	for (const e of entries) logger.log(" -", e.replace(ROOT + "/", ""));

	const autoName = generateOutputName(entries);
	const outDir = output.dir;
	const limit = resolve.limit;

	let outputBase = autoName;

	if (showUi) {
		const { outputBase: answer } = await inquirer.prompt([
			{
				type: "input",
				name: "outputBase",
				message: "Output file name (without extension):",
				default: autoName,
				filter: (v) => (v.trim() || autoName).replace(/[<>:"/\\|?*]+/g, "_"),
			},
		]);
		outputBase = answer;
	}

	try {
		fs.mkdirSync(outDir, { recursive: true });
	} catch {
		logger.warn("Could not create outDir directory:", outDir);
	}

	const outputPath = resolveOutDirPath(outDir, outputBase, toMd);
	showSummary({ outDir, fileName: path.basename(outputPath), entries });

	const result = await followChain(entries, cfg, limit);
	const withIncludes = await applyIncludes(cfg, result.files);
	const sorted = [...withIncludes].sort((a, b) => a.localeCompare(b));

	const content = toMd ? [tocTxt(sorted), ...sorted.map(renderTxt)].join("") : [tocMd(sorted), ...sorted.map((f, i) => renderMd(f, i))].join("\n");

	fs.writeFileSync(outputPath, content, "utf8");

	logger.log(`\n✅ ${outputPath.norm()}`);
	importSummary(result);
}
