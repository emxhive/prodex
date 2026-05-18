import path from "path";
import { INDEX_RANGE_PLACEHOLDER, LANG_MAP, LLM_NOTE, MD_FOOTER, MD_HEADER } from "./render-constants";
import { readFileSafe, rel } from "../filesystem/read-file";

export interface MdTraceEntry {
	file: string;
	anchor: number;
	startLine: number;
	endLine: number;
}

export function renderTraceMd(files: string[], root = process.cwd()) {
	const sections = files.map((file, index) => renderMdSection(file, index, root));
	const firstPassToc = buildToc({
		files,
		root,
		count: files.length,
		listingStart: 0,
		listingEnd: 0,
		trace: null,
		withRanges: false,
	});

	const firstPassContent = [firstPassToc, ...sections, MD_FOOTER].join("\n");
	const firstPassAnalysis = analyzeTrace(firstPassContent, files.length);
	const finalToc = buildToc({
		files,
		root,
		count: files.length,
		listingStart: firstPassAnalysis.listingStart,
		listingEnd: firstPassAnalysis.listingEnd,
		trace: firstPassAnalysis.trace,
		withRanges: true,
	});

	const content = [finalToc, ...sections, MD_FOOTER].join("\n");
	const analysis = analyzeTrace(content, files.length);

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

	return [
		MD_HEADER,
		LLM_NOTE,
		"",
		"# Index",
		`<!-- PRODEX_INDEX_RANGE: ${indexRange} -->`,
		`<!-- PRODEX_FILE_COUNT: ${opts.count} -->`,
		"<!-- PRODEX_INDEX_LIST_START -->",
		...items,
		"<!-- PRODEX_INDEX_LIST_END -->",
		"",
		"---",
	].join("\n");
}

function analyzeTrace(content: string, count: number): {
	listingStart: number;
	listingEnd: number;
	trace: MdTraceEntry[];
} {
	const lines = content.split("\n");
	const startMarkerIndex = lines.findIndex((line) => line.trim() === "<!-- PRODEX_INDEX_LIST_START -->");
	const endMarkerIndex = lines.findIndex((line) => line.trim() === "<!-- PRODEX_INDEX_LIST_END -->");
	const { listingStart, listingEnd } = analyzeListingRange(lines, startMarkerIndex, endMarkerIndex, count);
	const footerStartIndex = findFooterStartIndex(lines);
	const sectionStarts = findSectionStartIndexes(lines, count, footerStartIndex);

	return {
		listingStart,
		listingEnd,
		trace: sectionStarts.map((startIndex, index) => {
			const nextStart = index < count - 1 ? sectionStarts[index + 1] : footerStartIndex;
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
	const footerMarker = lines.findIndex((line) => line.includes("<!-- PRODEx v") || line.includes("*Generated with [Prodex]"));
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

function renderMdSection(filePath: string, index: number, root: string): string {
	const relativePath = rel(filePath, root);
	const ext = path.extname(filePath).toLowerCase();
	const lang = LANG_MAP[ext] || "txt";
	const code = readFileSafe(filePath).trimEnd();

	return [
		`---\n#### ${index + 1}`,
		"\n",
		"` File: " + relativePath + "`  [Back to top](#index)",
		"",
		"```" + lang,
		code,
		"```",
		"",
	].join("\n");
}
