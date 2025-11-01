import fs from "fs";
import path from "path";
import { prompt } from "../lib/prompt";
import { renderMd, renderTxt, tocMd, tocTxt } from "./renderers";
import { logger } from "../lib/logger";
import type { OutputParams } from "../types";
import { shortTimestamp } from "../lib/utils";
import { OUTPUT_NAME_QUESTION } from "../lib/questions";
import { MD_FOOTER } from "../constants/render-constants";
import { SUFFIX } from "../constants/config";

/**
 * 🧩 produceOutput()
 * Handles rendering and writing of the final trace file.
 * Receives resolved files and configuration from combine.ts.
 */
export async function produceOutput({ name, files, cfg, showUi }: OutputParams): Promise<string> {
	const {
		output: { format, versioned, dir },
	} = cfg;

	;

	// 1️⃣ Determine base filename
	let outputBase = name;
	if (showUi) {
		const result = await prompt<{ outputBase: string }>(OUTPUT_NAME_QUESTION);
		if (result?.outputBase) outputBase = result.outputBase;
	}

	// 2️⃣ Prefix timestamp if versioned
	outputBase = `${outputBase}-${SUFFIX}`;
	if (versioned) outputBase = `${outputBase}_${shortTimestamp()}`;

	// 3️⃣ Ensure output directory
	try {
		fs.mkdirSync(dir, { recursive: true });
	} catch {
		logger.warn("Could not create dir directory:", dir);
	}

	// 4️⃣ Prepare and write content
	const outputPath = path.join(dir, `${outputBase}.${format}`);

	const sorted = [...files].sort((a, b) => a.localeCompare(b));
	const content = format === "txt" ? [tocTxt(sorted), ...sorted.map(renderTxt)].join("") : [tocMd(sorted), ...sorted.map((f, i) => renderMd(f, i)), MD_FOOTER].join("\n");

	fs.writeFileSync(outputPath, content, "utf8");

	return outputPath;
}
