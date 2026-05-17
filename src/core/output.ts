import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";
import type { OutputParams } from "../types";
import { shortTimestamp } from "../lib/utils";
import { SUFFIX } from "../constants";
import { renderTraceMd, renderTxt, tocTxt } from "./renderers";
import { sanitizeFileName } from "../platform/path";

export async function produceOutput({ name, files, cfg }: OutputParams): Promise<string> {
	const {
		output: { format, versioned, dir },
	} = cfg;

	let outputBase = sanitizeFileName(name || "combined");
	outputBase = `${outputBase}-${SUFFIX}`;
	if (versioned) outputBase = `${outputBase}_${shortTimestamp()}`;

	const outputDir = path.isAbsolute(dir) ? dir : path.join(cfg.root, dir);

	try {
		fs.mkdirSync(outputDir, { recursive: true });
	} catch {
		logger.warn("Could not create output directory:", outputDir);
	}

	const outputPath = path.join(outputDir, `${outputBase}.${format}`);
	const sorted = [...files].sort((a, b) => a.localeCompare(b));
	const content =
		format === "txt"
			? [tocTxt(sorted), ...sorted.map(renderTxt)].join("")
			: renderTraceMd(sorted).content;

	fs.writeFileSync(outputPath, content, "utf8");
	return outputPath;
}
