import fs from "fs";
import path from "path";
import { logger } from "../diagnostics/logger";
import type { OutputParams } from "../types";
import { shortTimestamp } from "./naming";
import { SUFFIX } from "./render-constants";
import { renderTraceMd } from "./markdown";
import { renderTxt } from "./text";
import { sanitizeFileName } from "../filesystem/path";

export async function produceOutput({
	name,
	payload,
	format,
	dir,
	versioned,
}: OutputParams): Promise<{ outputPath: string; outputSizeBytes: number }> {
	let outputBase = sanitizeFileName(name || "combined");
	outputBase = `${outputBase}-${SUFFIX}`;
	if (versioned) outputBase = `${outputBase}_${shortTimestamp()}`;

	const outputDir = path.isAbsolute(dir) ? dir : path.join(payload.root, dir);

	try {
		fs.mkdirSync(outputDir, { recursive: true });
	} catch {
		logger.warn("Could not create output directory:", outputDir);
	}

	const outputPath = path.join(outputDir, `${outputBase}.${format}`);
	const content =
		format === "txt"
			? renderTxt(payload)
			: renderTraceMd(payload).content;

	fs.writeFileSync(outputPath, content, "utf8");
	const outputSizeBytes = Buffer.byteLength(content, "utf8");

	return { outputPath, outputSizeBytes };
}
