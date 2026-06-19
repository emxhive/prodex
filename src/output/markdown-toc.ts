import path from "path";
import { INDEX_RANGE_PLACEHOLDER, LLM_NOTE, MD_HEADER } from "./render-constants";
import { rel } from "../filesystem/read-file";
import { getLayoutOrder } from "./render-helpers";
import type { ArtifactMetadata, ArtifactSection, CommandOutputResult, MdTraceEntry } from "../types";

export function getLineBlocks(lines: string[]): boolean[] {
	const inside = new Array(lines.length).fill(false);
	let activeFenceChar: string | null = null;
	let activeFenceLength = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (activeFenceChar) {
			inside[i] = true;
			const match = trimmed.match(/^([`~]{3,})\s*$/);
			if (match) {
				const char = match[1][0];
				const length = match[1].length;
				if (char === activeFenceChar && length >= activeFenceLength) {
					activeFenceChar = null;
					activeFenceLength = 0;
				}
			}
		} else {
			const match = trimmed.match(/^([`~]{3,})/);
			if (match) {
				activeFenceChar = match[1][0];
				activeFenceLength = match[1].length;
				inside[i] = true;
			}
		}
	}
	return inside;
}

export function analyzeTrace(
	content: string,
	count: number,
	sectionCount: number,
	cmdCount: number,
): {
	listingStart: number;
	listingEnd: number;
	trace: MdTraceEntry[];
	sectionTrace: MdTraceEntry[];
	cmdTrace: MdTraceEntry[];
} {
	const lines = content.split("\n");
	const insideCodeFence = getLineBlocks(lines);

	const startMarkerIndex = lines.findIndex((line) => line.trim() === "<!-- PRODEX_INDEX_LIST_START -->");
	const endMarkerIndex = lines.findIndex((line) => line.trim() === "<!-- PRODEX_INDEX_LIST_END -->");
	const totalItems = count + sectionCount + cmdCount;
	const { listingStart, listingEnd } = analyzeListingRange(lines, startMarkerIndex, endMarkerIndex, totalItems);

	const footerStartIndex = findFooterStartIndex(lines, insideCodeFence);
	const sectionStarts = findSectionStartIndexes(lines, count, footerStartIndex, insideCodeFence);
	const genericStarts = findGenericSectionStartIndexes(lines, sectionCount, footerStartIndex, insideCodeFence);
	const cmdStarts = findCmdSectionStartIndexes(lines, cmdCount, footerStartIndex, insideCodeFence);

	const allStarts = [
		...sectionStarts,
		...genericStarts,
		...cmdStarts,
		footerStartIndex
	];
	const uniqueStarts = [...new Set(allStarts)].sort((a, b) => a - b);

	const getEndLine = (start: number) => {
		if (start >= footerStartIndex) return start;
		const nextStart = uniqueStarts.find(val => val > start) ?? footerStartIndex;
		return Math.max(start, nextStart - 1);
	};

	return {
		listingStart,
		listingEnd,
		sectionTrace: genericStarts.map((startIndex, index) => {
			const endIndex = getEndLine(startIndex);
			return {
				file: "",
				anchor: index + 1,
				startLine: startIndex + 1,
				endLine: endIndex + 1,
			};
		}),
		trace: sectionStarts.map((startIndex, index) => {
			const endIndex = getEndLine(startIndex);
			return {
				file: "",
				anchor: index + 1,
				startLine: startIndex + 1,
				endLine: endIndex + 1,
			};
		}),
		cmdTrace: cmdStarts.map((startIndex, index) => {
			const endIndex = getEndLine(startIndex);
			return {
				file: "",
				anchor: index + 1,
				startLine: startIndex + 1,
				endLine: endIndex + 1,
			};
		}),
	};
}

export function analyzeListingRange(
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

export function findFooterStartIndex(lines: string[], insideCodeFence: boolean[]): number {
	let footerMarker = -1;
	for (let i = 0; i < lines.length; i++) {
		if (insideCodeFence[i]) continue;
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

export function findSectionStartIndexes(
	lines: string[],
	count: number,
	fallbackIndex: number,
	insideCodeFence: boolean[],
): number[] {
	const markerByAnchor = new Map<number, number>();
	for (let index = 0; index < lines.length; index++) {
		if (insideCodeFence[index]) continue;
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

export function findGenericSectionStartIndexes(
	lines: string[],
	sectionCount: number,
	fallbackIndex: number,
	insideCodeFence: boolean[],
): number[] {
	const markerBySec = new Map<number, number>();
	for (let index = 0; index < lines.length; index++) {
		if (insideCodeFence[index]) continue;
		const match = lines[index].trim().match(/<a id="sec-(\d+)"><\/a>/);
		if (!match) continue;
		const secIdx = Number(match[1]);
		if (Number.isFinite(secIdx) && secIdx >= 1 && secIdx <= sectionCount && !markerBySec.has(secIdx)) {
			let startIndex = index;
			if (startIndex > 0 && lines[startIndex - 1].trim() === "---") {
				startIndex--;
			}
			markerBySec.set(secIdx, startIndex);
		}
	}

	const starts: number[] = [];
	for (let secIdx = 1; secIdx <= sectionCount; secIdx++) {
		const markerIndex = markerBySec.get(secIdx);
		starts.push(markerIndex !== undefined ? markerIndex : fallbackIndex);
	}
	return starts;
}

export function findCmdSectionStartIndexes(
	lines: string[],
	cmdCount: number,
	fallbackIndex: number,
	insideCodeFence: boolean[],
): number[] {
	const markerByCmd = new Map<number, number>();
	for (let index = 0; index < lines.length; index++) {
		if (insideCodeFence[index]) continue;
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

export function buildToc(opts: {
	files: string[];
	root: string;
	count: number;
	listingStart: number;
	listingEnd: number;
	trace: MdTraceEntry[] | null;
	sectionTrace: MdTraceEntry[] | null;
	cmdTrace: MdTraceEntry[] | null;
	sections?: ArtifactSection[];
	commandOutputs?: CommandOutputResult[];
	withRanges: boolean;
	metadata?: ArtifactMetadata;
}): string {
	const sectionCount = opts.sections?.length ?? 0;
	const cmdCount = opts.commandOutputs?.length ?? 0;
	const fileCount = opts.files.length;

	const indexRange =
		opts.withRanges && opts.listingStart && opts.listingEnd
			? `L${opts.listingStart}-L${opts.listingEnd}`
			: INDEX_RANGE_PLACEHOLDER;

	const headers = [
		MD_HEADER,
		LLM_NOTE,
		"",
		"# Index",
	];

	if (opts.metadata?.commandKind === "trace" && opts.metadata.targets && opts.metadata.targets.length > 0) {
		const relativeEntries = opts.metadata.entries.map(e => rel(e, opts.root));
		headers.push(
			"",
			"> **Trace Target Context**",
			`> - **Requested Target(s):** ${opts.metadata.targets.map(t => `\`${t}\``).join(", ")}`,
			`> - **Resolved Starting Point(s):** ${relativeEntries.map(e => `\`${e}\``).join(", ") || "none"}`,
			`> - **Traversal Depth:** \`${opts.metadata.depth !== undefined ? opts.metadata.depth : "none"}\``,
			""
		);
	}

	headers.push(
		`<!-- PRODEX_INDEX_RANGE: ${indexRange} -->`,
		`<!-- PRODEX_FILE_COUNT: ${opts.count} -->`,
	);

	if (sectionCount > 0) {
		headers.push(`<!-- PRODEX_SECTION_COUNT: ${sectionCount} -->`);
	}
	if (cmdCount > 0) {
		headers.push(`<!-- PRODEX_COMMAND_OUTPUT_COUNT: ${cmdCount} -->`);
	}

	headers.push("<!-- PRODEX_INDEX_LIST_START -->");

	const layoutOrder = getLayoutOrder(opts.metadata?.commandKind);
	const isFileFirst = layoutOrder === "files-first";

	const secItems = (sectionCount > 0 && opts.sections) ? opts.sections.map((sec, index) => {
		const label = sec.title;
		if (!opts.withRanges || !opts.sectionTrace) {
			return `- [${label}](#sec-${index + 1})`;
		}
		const trace = opts.sectionTrace[index];
		return `- [${label}](#sec-${index + 1}) L${trace.startLine}-L${trace.endLine}`;
	}) : [];

	const fileItems = fileCount > 0 ? opts.files.map((file, index) => {
		const relativePath = rel(file, opts.root);
		if (!opts.withRanges || !opts.trace) {
			return `- [${relativePath}](#${index + 1})`;
		}
		const trace = opts.trace[index];
		return `- [${relativePath}](#${index + 1}) L${trace.startLine}-L${trace.endLine}`;
	}) : [];

	const cmdItems = (cmdCount > 0 && opts.commandOutputs) ? opts.commandOutputs.map((cmd, index) => {
		const label = `Command ${index + 1}: ${cmd.command}`;
		if (!opts.withRanges || !opts.cmdTrace) {
			return `- [${label}](#cmd-${index + 1})`;
		}
		const trace = opts.cmdTrace[index];
		return `- [${label}](#cmd-${index + 1}) L${trace.startLine}-L${trace.endLine}`;
	}) : [];

	const categoryCount = (sectionCount > 0 ? 1 : 0) + (fileCount > 0 ? 1 : 0) + (cmdCount > 0 ? 1 : 0);
	const showHeaders = categoryCount > 1;
	const parts: { header: string; items: string[] }[] = [];

	if (isFileFirst) {
		if (fileCount > 0) parts.push({ header: "## Files", items: fileItems });
		if (cmdCount > 0) parts.push({ header: "## Command Outputs", items: cmdItems });
		if (sectionCount > 0) parts.push({ header: "## Metadata Sections", items: secItems });
	} else {
		if (sectionCount > 0) parts.push({ header: "## Metadata Sections", items: secItems });
		if (fileCount > 0) parts.push({ header: "## Files", items: fileItems });
		if (cmdCount > 0) parts.push({ header: "## Command Outputs", items: cmdItems });
	}

	parts.forEach((part, pIdx) => {
		if (pIdx > 0) {
			headers.push("");
		}
		if (showHeaders) {
			headers.push(part.header);
		}
		headers.push(...part.items);
	});

	headers.push("<!-- PRODEX_INDEX_LIST_END -->", "", "---");

	return headers.join("\n");
}
