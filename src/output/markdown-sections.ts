import path from "path";
import { LANG_MAP } from "./render-constants";
import { rel } from "../filesystem/read-file";
import { formatExitCode, formatTimeout } from "./render-helpers";
import type { ArtifactSection, CommandOutputResult, FileSnapshot } from "../types";

export function getDynamicFence(output: string): string {
	const matches = output.match(/`+/g);
	if (!matches) return "```";
	const maxLength = Math.max(...matches.map((m) => m.length));
	if (maxLength >= 3) {
		return "`".repeat(maxLength + 1);
	}
	return "```";
}

export function renderFileSection(file: FileSnapshot, index: number, root: string, navLine: string): string {
	const relativePath = rel(file.path, root);
	const ext = path.extname(file.path).toLowerCase();
	const lang = LANG_MAP[ext] || "txt";
	const code = file.readError ? `Error reading file: ${file.readError}` : file.content.trimEnd();
	const fence = getDynamicFence(code);

	return [
		`---\n#### ${index + 1}`,
		"\n",
		`\` File: ${relativePath} \`  ${navLine}`,
		"",
		fence + lang,
		code,
		fence,
		"",
	].join("\n");
}

export function renderGenericSection(sec: ArtifactSection, index: number, navLine: string): string {
	const lang = sec.language || "txt";
	const fence = getDynamicFence(sec.content);
	return [
		`---\n<a id="sec-${index + 1}"></a>`,
		`## ${sec.title}`,
		navLine,
		"",
		fence + lang,
		sec.content.trimEnd(),
		fence,
		"",
	].join("\n");
}

export function renderMdCmdResults(
	cmdResults?: CommandOutputResult[],
	root = process.cwd(),
	totalCount = 0,
	sectionCount = 0,
	orderedAnchors?: string[],
): string {
	if (!cmdResults || cmdResults.length === 0) return "";

	const lines: string[] = ["\n---", "# Command Outputs", ""];
	const cmdCount = cmdResults.length;
	for (let i = 0; i < cmdCount; i++) {
		const res = cmdResults[i];
		const relativeDir = rel(res.cwd, root) || ".";
		const durationSec = (res.durationMs / 1000).toFixed(1);
		const fence = getDynamicFence(res.combinedOutput);

		const anchorId = `cmd-${i + 1}`;
		let navLine: string;
		if (orderedAnchors) {
			const idx = orderedAnchors.indexOf(anchorId);
			const navParts: string[] = [];
			if (idx > 0) {
				navParts.push(`[Previous](#${orderedAnchors[idx - 1]})`);
			}
			navParts.push(`[Back to top](#index)`);
			if (idx < orderedAnchors.length - 1) {
				navParts.push(`[Next](#${orderedAnchors[idx + 1]})`);
			}
			navLine = navParts.join(" | ");
		} else {
			const navParts: string[] = [];
			if (i > 0) {
				navParts.push(`[Previous](#cmd-${i})`);
			} else if (totalCount > 0) {
				navParts.push(`[Previous](#${totalCount})`);
			} else if (sectionCount > 0) {
				navParts.push(`[Previous](#sec-${sectionCount})`);
			}
			navParts.push(`[Back to top](#index)`);
			if (i < cmdCount - 1) {
				navParts.push(`[Next](#cmd-${i + 2})`);
			}
			navLine = navParts.join(" | ");
		}

		lines.push(
			`---`,
			`<a id="cmd-${i + 1}"></a>`,
			`## Command ${i + 1}: ${res.command}`,
			navLine,
			"",
			`- Status: ${res.status}`,
			`- Exit code: ${formatExitCode(res.exitCode)}`,
			`- Duration: ${durationSec}s`,
			`- Timed out: ${formatTimeout(res.timedOut)}`,
			`- Working directory: ${relativeDir}`,
			"",
		);

		if (res.errorMessage) {
			lines.push(`- Error message: ${res.errorMessage}`, "");
		}

		lines.push(fence + "text", res.combinedOutput, fence, "");
	}
	return lines.join("\n");
}
