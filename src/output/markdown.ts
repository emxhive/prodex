import { MD_FOOTER } from "./render-constants";
import { getLayoutOrder } from "./render-helpers";
import { buildToc, analyzeTrace } from "./markdown-toc";
import { renderFileSection, renderGenericSection, renderMdCmdResults } from "./markdown-sections";
import type { ArtifactPayload } from "../types";

export { MdTraceEntry } from "../types";
export { renderMdCmdResults } from "./markdown-sections";

export function renderTraceMd(payload: ArtifactPayload) {
	const root = payload.root;
	const sorted = [...payload.files].sort((a, b) => a.path.localeCompare(b.path));
	const filesList = sorted.map((f) => f.path);
	const cmdCount = payload.commandOutputs?.length ?? 0;
	const sectionCount = payload.sections?.length ?? 0;

	const layoutOrder = getLayoutOrder(payload.metadata?.commandKind);
	const isFileFirst = layoutOrder === "files-first";

	// Build exact sequence of anchors to generate correct sequentially-flowing navigation
	const orderedAnchors: string[] = [];
	if (isFileFirst) {
		for (let i = 1; i <= sorted.length; i++) orderedAnchors.push(`${i}`);
		for (let i = 1; i <= cmdCount; i++) orderedAnchors.push(`cmd-${i}`);
		for (let i = 1; i <= sectionCount; i++) orderedAnchors.push(`sec-${i}`);
	} else {
		for (let i = 1; i <= sectionCount; i++) orderedAnchors.push(`sec-${i}`);
		for (let i = 1; i <= sorted.length; i++) orderedAnchors.push(`${i}`);
		for (let i = 1; i <= cmdCount; i++) orderedAnchors.push(`cmd-${i}`);
	}

	const getNavLine = (anchorId: string): string => {
		const idx = orderedAnchors.indexOf(anchorId);
		if (idx === -1) return `[Back to top](#index)`;
		const navParts: string[] = [];
		if (idx > 0) {
			navParts.push(`[Previous](#${orderedAnchors[idx - 1]})`);
		}
		navParts.push(`[Back to top](#index)`);
		if (idx < orderedAnchors.length - 1) {
			navParts.push(`[Next](#${orderedAnchors[idx + 1]})`);
		}
		return navParts.join(" | ");
	};

	// Render generic sections
	const genericSections = (payload.sections ?? []).map((sec, index) => {
		const navLine = getNavLine(`sec-${index + 1}`);
		return renderGenericSection(sec, index, navLine);
	});

	// Render file snapshots
	const fileSections = sorted.map((file, index) => {
		const navLine = getNavLine(`${index + 1}`);
		return renderFileSection(file, index, root, navLine);
	});

	const firstPassToc = buildToc({
		files: filesList,
		root,
		count: sorted.length,
		listingStart: 0,
		listingEnd: 0,
		trace: null,
		sectionTrace: null,
		cmdTrace: null,
		sections: payload.sections,
		commandOutputs: payload.commandOutputs,
		withRanges: false,
		metadata: payload.metadata,
	});

	const cmdSections = renderMdCmdResults(payload.commandOutputs, root, sorted.length, sectionCount, orderedAnchors);

	const bodySections = isFileFirst
		? [...fileSections, cmdSections, ...genericSections]
		: [...genericSections, ...fileSections, cmdSections];

	const firstPassContent = [firstPassToc, ...bodySections.filter(Boolean), MD_FOOTER].join("\n");
	const firstPassAnalysis = analyzeTrace(firstPassContent, sorted.length, sectionCount, cmdCount);
	const finalToc = buildToc({
		files: filesList,
		root,
		count: sorted.length,
		listingStart: firstPassAnalysis.listingStart,
		listingEnd: firstPassAnalysis.listingEnd,
		trace: firstPassAnalysis.trace,
		sectionTrace: firstPassAnalysis.sectionTrace,
		cmdTrace: firstPassAnalysis.cmdTrace,
		sections: payload.sections,
		commandOutputs: payload.commandOutputs,
		withRanges: true,
		metadata: payload.metadata,
	});

	const content = [finalToc, ...bodySections.filter(Boolean), MD_FOOTER].join("\n");
	const analysis = analyzeTrace(content, sorted.length, sectionCount, cmdCount);

	return {
		content,
		trace: analysis.trace,
		listingStart: analysis.listingStart,
		listingEnd: analysis.listingEnd,
	};
}
