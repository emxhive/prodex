import fs from "fs";
import path from "path";
import { logger } from "../diagnostics/logger";
import type { OutputParams } from "../types";
import { shortTimestamp } from "./naming";
import { SUFFIX } from "./render-constants";
import { renderTraceMd } from "./markdown";
import { renderTxt, tocTxt } from "./text";
import { sanitizeFileName } from "../filesystem/path";

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
			? [tocTxt(sorted, cfg.root), ...sorted.map((file) => renderTxt(file, cfg.root))].join("")
			: renderTraceMd(sorted, cfg.root).content;

	fs.writeFileSync(outputPath, content, "utf8");
	return outputPath;
}
