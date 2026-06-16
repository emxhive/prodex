import path from "path";
import { INDEX_RANGE_PLACEHOLDER, LANG_MAP, LLM_NOTE, MD_FOOTER, MD_HEADER } from "./render-constants";
import { rel } from "../filesystem/read-file";
import type { ArtifactPayload, FileSnapshot, CommandOutputResult } from "../types";

export interface MdTraceEntry {
	file: string;
	anchor: number;
	startLine: number;
	endLine: number;
}

export function renderTraceMd(payload: ArtifactPayload) {
	const root = payload.root;
	const sorted = [...payload.files].sort((a, b) => a.path.localeCompare(b.path));
	const filesList = sorted.map((f) => f.path);
	const cmdCount = payload.commandOutputs?.length ?? 0;
	const hasCmdOutputs = cmdCount > 0;

	const sections = sorted.map((file, index) =>
		renderMdSection(file, index, sorted.length, hasCmdOutputs, root)
	);
	const firstPassToc = buildToc({
		files: filesList,
		root,
		count: sorted.length,
		listingStart: 0,
		listingEnd: 0,
		trace: null,
		cmdTrace: null,
		commandOutputs: payload.commandOutputs,
		withRanges: false,
	});

	const cmdSections = renderMdCmdResults(payload.commandOutputs, root, sorted.length);

	const firstPassContent = [firstPassToc, ...sections, cmdSections, MD_FOOTER].join("\n");
	const firstPassAnalysis = analyzeTrace(firstPassContent, sorted.length, cmdCount);
	const finalToc = buildToc({
		files: filesList,
		root,
		count: sorted.length,
		listingStart: firstPassAnalysis.listingStart,
		listingEnd: firstPassAnalysis.listingEnd,
		trace: firstPassAnalysis.trace,
		cmdTrace: firstPassAnalysis.cmdTrace,
		commandOutputs: payload.commandOutputs,
		withRanges: true,
	});

	const content = [finalToc, ...sections, cmdSections, MD_FOOTER].join("\n");
	const analysis = analyzeTrace(content, sorted.length, cmdCount);

	return {
		content,
		trace: analysis.trace,
		listingStart: analysis.listingStart,
		listingEnd: analysis.listingEnd,
	};
}

function buildToc(opts: {
	files: string[];
	root: string;
	count: number;
	listingStart: number;
	listingEnd: number;
	trace: MdTraceEntry[] | null;
	cmdTrace: MdTraceEntry[] | null;
	commandOutputs?: CommandOutputResult[];
	withRanges: boolean;
}): string {
	const indexRange =
		opts.withRanges && opts.listingStart && opts.listingEnd
			? `L${opts.listingStart}-L${opts.listingEnd}`
			: INDEX_RANGE_PLACEHOLDER;

	const items = opts.files.map((file, index) => {
		const relativePath = rel(file, opts.root);
		if (!opts.withRanges || !opts.trace) return `- [${relativePath}](#${index + 1})`;
		const trace = opts.trace[index];
		return `- [${relativePath}](#${index + 1}) L${trace.startLine}-L${trace.endLine}`;
	});

	const cmdCount = opts.commandOutputs?.length ?? 0;

	const headers = [
		MD_HEADER,
		LLM_NOTE,
		"",
		"# Index",
		`<!-- PRODEX_INDEX_RANGE: ${indexRange} -->`,
		`<!-- PRODEX_FILE_COUNT: ${opts.count} -->`,
	];

	if (cmdCount > 0) {
		headers.push(`<!-- PRODEX_COMMAND_OUTPUT_COUNT: ${cmdCount} -->`);
	}

	headers.push("<!-- PRODEX_INDEX_LIST_START -->");

	if (cmdCount > 0) {
		headers.push("## Files");
	}

	headers.push(...items);

	if (cmdCount > 0 && opts.commandOutputs) {
		headers.push("", "## Command Outputs");
		const cmdItems = opts.commandOutputs.map((cmd, index) => {
			const label = `Command ${index + 1}: ${cmd.command}`;
			if (!opts.withRanges || !opts.cmdTrace) {
				return `- [${label}](#cmd-${index + 1})`;
			}
			const trace = opts.cmdTrace[index];
			return `- [${label}](#cmd-${index + 1}) L${trace.startLine}-L${trace.endLine}`;
		});
		headers.push(...cmdItems);
	}

	headers.push("<!-- PRODEX_INDEX_LIST_END -->", "", "---");

	return headers.join("\n");
}

function analyzeTrace(content: string, count: number, cmdCount: number): {
	listingStart: number;
	listingEnd: number;
	trace: MdTraceEntry[];
	cmdTrace: MdTraceEntry[];
} {
	const lines = content.split("\n");
	const startMarkerIndex = lines.findIndex((line) => line.trim() === "<!-- PRODEX_INDEX_LIST_START -->");
	const endMarkerIndex = lines.findIndex((line) => line.trim() === "<!-- PRODEX_INDEX_LIST_END -->");
	const { listingStart, listingEnd } = analyzeListingRange(lines, startMarkerIndex, endMarkerIndex, count + cmdCount);
	const footerStartIndex = findFooterStartIndex(lines);
	const sectionStarts = findSectionStartIndexes(lines, count, footerStartIndex);

	let lastSectionEndIndex = footerStartIndex;
	const cmdOutputsStartIndex = lines.findIndex((line) => line.trim() === "# Command Outputs");
	if (cmdOutputsStartIndex >= 0) {
		let limitIndex = cmdOutputsStartIndex;
		if (limitIndex > 0 && lines[limitIndex - 1].trim() === "---") {
			limitIndex--;
		}
		lastSectionEndIndex = limitIndex;
	}

	const cmdStarts = findCmdSectionStartIndexes(lines, cmdCount, footerStartIndex);

	return {
		listingStart,
		listingEnd,
		trace: sectionStarts.map((startIndex, index) => {
			const nextStart = index < count - 1 ? sectionStarts[index + 1] : lastSectionEndIndex;
			const endIndex = Math.max(startIndex, nextStart - 1);
			return {
				file: "",
				anchor: index + 1,
				startLine: startIndex + 1,
				endLine: endIndex + 1,
			};
		}),
		cmdTrace: cmdStarts.map((startIndex, index) => {
			const nextStart = index < cmdCount - 1 ? cmdStarts[index + 1] : footerStartIndex;
			const endIndex = Math.max(startIndex, nextStart - 1);
			return {
				file: "",
				anchor: index + 1,
				startLine: startIndex + 1,
				endLine: endIndex + 1,
			};
		}),
	};
}

function analyzeListingRange(
	lines: string[],
	startMarkerIndex: number,
	endMarkerIndex: number,
	count: number,
): { listingStart: number; listingEnd: number } {
	if (startMarkerIndex < 0 || endMarkerIndex <= startMarkerIndex) return { listingStart: 0, listingEnd: 0 };

	const itemIndexes: number[] = [];
	for (let index = startMarkerIndex + 1; index < endMarkerIndex; index++) {
		if (lines[index].trim().startsWith("- ")) itemIndexes.push(index);
	}

	if (!itemIndexes.length) {
		const markerLine = startMarkerIndex + 2;
		return { listingStart: markerLine, listingEnd: markerLine };
	}

	const cappedCount = count > 0 ? Math.min(itemIndexes.length, count) : itemIndexes.length;
	return {
		listingStart: itemIndexes[0] + 1,
		listingEnd: itemIndexes[cappedCount - 1] + 1,
	};
}

function findFooterStartIndex(lines: string[]): number {
	let footerMarker = -1;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.includes("<!-- PRODEx " + "v") || line.includes("*Generated with " + "[Prodex]")) {
			footerMarker = i;
			break;
		}
	}
	let footerStart = footerMarker >= 0 ? footerMarker : lines.length;
	if (footerStart > 0 && lines[footerStart - 1].trim() === "---") footerStart--;
	return footerStart;
}

function findSectionStartIndexes(lines: string[], count: number, fallbackIndex: number): number[] {
	const markerByAnchor = new Map<number, number>();
	for (let index = 0; index < lines.length; index++) {
		const match = lines[index].trim().match(/^####\s+(\d+)\s*$/);
		if (!match) continue;
		const anchor = Number(match[1]);
		if (Number.isFinite(anchor) && anchor >= 1 && anchor <= count && !markerByAnchor.has(anchor)) {
			markerByAnchor.set(anchor, index);
		}
	}

	const starts: number[] = [];
	for (let anchor = 1; anchor <= count; anchor++) {
		const markerIndex = markerByAnchor.get(anchor);
		if (markerIndex == null) {
			starts.push(fallbackIndex);
			continue;
		}
		starts.push(markerIndex > 0 && lines[markerIndex - 1].trim() === "---" ? markerIndex - 1 : markerIndex);
	}
	return starts;
}

function findCmdSectionStartIndexes(lines: string[], cmdCount: number, fallbackIndex: number): number[] {
	const markerByCmd = new Map<number, number>();
	for (let index = 0; index < lines.length; index++) {
		const match = lines[index].trim().match(/<a id="cmd-(\d+)"><\/a>/);
		if (!match) continue;
		const cmdIdx = Number(match[1]);
		if (Number.isFinite(cmdIdx) && cmdIdx >= 1 && cmdIdx <= cmdCount && !markerByCmd.has(cmdIdx)) {
			let startIndex = index;
			if (startIndex > 0 && lines[startIndex - 1].trim() === "---") {
				startIndex--;
			}
			markerByCmd.set(cmdIdx, startIndex);
		}
	}

	const starts: number[] = [];
	for (let cmdIdx = 1; cmdIdx <= cmdCount; cmdIdx++) {
		const markerIndex = markerByCmd.get(cmdIdx);
		starts.push(markerIndex !== undefined ? markerIndex : fallbackIndex);
	}
	return starts;
}

function renderMdSection(file: FileSnapshot, index: number, totalCount: number, hasCmdOutputs: boolean, root: string): string {
	const relativePath = rel(file.path, root);
	const ext = path.extname(file.path).toLowerCase();
	const lang = LANG_MAP[ext] || "txt";
	const code = file.readError ? `Error reading file: ${file.readError}` : file.content.trimEnd();

	const navParts: string[] = [];
	if (index > 0) {
		navParts.push(`[Previous](#${index})`);
	}
	navParts.push(`[Back to top](#index)`);
	if (index < totalCount - 1) {
		navParts.push(`[Next](#${index + 2})`);
	} else if (hasCmdOutputs) {
		navParts.push(`[Next](#cmd-1)`);
	}
	const navLine = navParts.join(" | ");

	return [
		`---\n#### ${index + 1}`,
		"\n",
		`\` File: ${relativePath} \`  ${navLine}`,
		"",
		"```" + lang,
		code,
		"```",
		"",
	].join("\n");
}

function getDynamicFence(output: string): string {
	const matches = output.match(/`+/g);
	if (!matches) return "```";
	const maxLength = Math.max(...matches.map((m) => m.length));
	if (maxLength >= 3) {
		return "`".repeat(maxLength + 1);
	}
	return "```";
}

export function renderMdCmdResults(cmdResults?: CommandOutputResult[], root = process.cwd(), totalCount = 0): string {
	if (!cmdResults || cmdResults.length === 0) return "";

	const lines: string[] = ["\n---", "# Command Outputs", ""];
	const cmdCount = cmdResults.length;
	for (let i = 0; i < cmdCount; i++) {
		const res = cmdResults[i];
		const relativeDir = rel(res.cwd, root) || ".";
		const durationSec = (res.durationMs / 1000).toFixed(1);
		const fence = getDynamicFence(res.combinedOutput);

		const navParts: string[] = [];
		if (i > 0) {
			navParts.push(`[Previous](#cmd-${i})`);
		} else if (totalCount > 0) {
			navParts.push(`[Previous](#${totalCount})`);
		}
		navParts.push(`[Back to top](#index)`);
		if (i < cmdCount - 1) {
			navParts.push(`[Next](#cmd-${i + 2})`);
		}
		const navLine = navParts.join(" | ");

		lines.push(
			`---`,
			`<a id="cmd-${i + 1}"></a>`,
			`## Command ${i + 1}: ${res.command}`,
			navLine,
			"",
			`- Status: ${res.status}`,
			`- Exit code: ${res.exitCode !== null ? res.exitCode : "null"}`,
			`- Duration: ${durationSec}s`,
			`- Timed out: ${res.timedOut ? "yes" : "no"}`,
			`- Working directory: ${relativeDir}`,
			""
		);

		if (res.errorMessage) {
			lines.push(`- Error message: ${res.errorMessage}`, "");
		}

		lines.push(fence + "text", res.combinedOutput, fence, "");
	}
	return lines.join("\n");
}
