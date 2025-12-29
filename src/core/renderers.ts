import path from "path";
import {readFileSafe} from "../shared";
import {rel} from "../shared";
import {LANG_MAP, MD_FOOTER, MD_HEADER} from "../constants";

export interface MdTraceEntry {
    file: string;
    anchor: number;   // 1-based anchor (matches #1, #2, ...)
    startLine: number;
    endLine: number;
}

/**
 * renderTraceMd()
 * Builds the full markdown document AND computes:
 * - listing start/end lines
 * - each file section start/end lines (in the final output)
 */
// src/core/renderers.ts

export function renderTraceMd(files: string[]) {
    const count = files.length;

    // Render sections once (content of each file)
    const sections = files.map((f, i) => renderMd(f, i));

    // 1) Build a FIRST PASS doc with placeholder TOC (no line ranges)
    const pass1Toc = buildToc({
        files,
        count,
        listingStart: 0,
        listingEnd: 0,
        trace: null,
        withRanges: false,
    });

    const pass1Content = [pass1Toc, ...sections, MD_FOOTER].join("\n");

    // 2) Analyze the FINAL STRING (pass 1) to get real line indexes
    const pass1Analysis = analyzeTrace(pass1Content, count);

    // 3) Build pass 2 TOC including listing range + per-file ranges
    const pass2Toc = buildToc({
        files,
        count,
        listingStart: pass1Analysis.listingStart,
        listingEnd: pass1Analysis.listingEnd,
        trace: pass1Analysis.trace,
        withRanges: true,
    });

    const pass2Content = [pass2Toc, ...sections, MD_FOOTER].join("\n");

    // 4) Re-analyze pass 2 content (should be identical; extra safety)
    const pass2Analysis = analyzeTrace(pass2Content, count);

    // If anything drifted (it really shouldn’t), trust pass 2’s analysis.
    // Rebuilding again would still not change line counts, so this is stable.
    return {
        content: pass2Content,
        trace: pass2Analysis.trace,
        listingStart: pass2Analysis.listingStart,
        listingEnd: pass2Analysis.listingEnd,
    };
}

const rangeText = (start: number, end: number) => ` L${start}-L${end}`;

function buildToc(opts: {
    files: string[];
    count: number;
    listingStart: number;
    listingEnd: number;
    trace: MdTraceEntry[] | null;
    withRanges: boolean;
}) {
    const {files, count, listingStart, listingEnd, trace, withRanges} = opts;


    const tocHead = [
        `# Index ${withRanges ? rangeText(listingStart, listingEnd) : ""} `,
        "",
        MD_HEADER,
        "",
        `Included Source Files: ${count}`,
    ];

    const items = files.map((f, i) => {
        const rp = rel(f);
        if (!withRanges || !trace) return `- [${rp}](#${i + 1})`;
        const t = trace[i];
        return `- [${rp}](#${i + 1}) ${rangeText(t.startLine, t.endLine)}`;
    });

    const tocTail = ["", "---"];

    return [...tocHead, ...items, ...tocTail].join("\n");
}

/**
 * Analyze the already-generated markdown to compute:
 * - listing start/end lines
 * - each section start/end line (per file index)
 *
 * All line numbers are 1-based.
 */
function analyzeTrace(content: string, count: number): {
    listingStart: number;
    listingEnd: number;
    trace: MdTraceEntry[]
} {
    const lines = content.split("\n");

    // --- Listing range ---
    const includedIdx = lines.findIndex((l) => /^Included Source Files\b/.test(l.trim()));
    // listing begins on the next line after the header
    const listingStart = includedIdx >= 0 ? includedIdx + 2 : 0; // 1-based
    const listingEnd = count ? listingStart + count - 1 : listingStart;

    // --- Footer start (exclude footer from last file range) ---
    let footerMarkerIdx = lines.findIndex((l) => l.includes("<!-- PRODEx v"));
    if (footerMarkerIdx < 0) footerMarkerIdx = lines.findIndex((l) => l.includes("*Generated with [Prodex]"));
    let footerStartIdx = footerMarkerIdx >= 0 ? footerMarkerIdx : lines.length; // 0-based
    if (footerStartIdx > 0 && lines[footerStartIdx - 1].trim() === "---") footerStartIdx = footerStartIdx - 1;

    // --- Section markers: find "#### N" lines ---
    const markerLineIdxByN = new Map<number, number>();
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].trim().match(/^####\s+(\d+)\s*$/);
        if (!m) continue;
        const n = Number(m[1]);
        if (!Number.isFinite(n)) continue;
        if (n < 1 || n > count) continue;
        if (!markerLineIdxByN.has(n)) markerLineIdxByN.set(n, i);
    }

    // Compute each section's start idx (prefer the preceding "---" line if present)
    const startIdxs: number[] = [];
    for (let n = 1; n <= count; n++) {
        const markerIdx = markerLineIdxByN.get(n);
        if (markerIdx == null) {
            // Fallback: if marker missing, make it non-crashy.
            // Put start at footerStart (it'll produce tiny/empty ranges rather than exploding).
            startIdxs.push(footerStartIdx);
            continue;
        }
        const maybeStart = markerIdx > 0 && lines[markerIdx - 1].trim() === "---" ? markerIdx - 1 : markerIdx;
        startIdxs.push(maybeStart);
    }

    // Compute end idx using next section start, or footer start
    const trace: MdTraceEntry[] = [];
    for (let i = 0; i < count; i++) {
        const startIdx = startIdxs[i];
        const nextStartIdx = i < count - 1 ? startIdxs[i + 1] : footerStartIdx;
        const endIdx = Math.max(startIdx, nextStartIdx - 1);

        trace.push({
            file: "", // filled by caller if needed; TOC uses rel(files[i]) anyway
            anchor: i + 1,
            startLine: startIdx + 1,
            endLine: endIdx + 1,
        });
    }

    return {listingStart, listingEnd, trace};
}

/**
 * Existing functions kept as-is.
 * (renderMd is used by renderTraceMd above)
 */
export function tocMd(files: string[]) {
    const count = files.length;
    const items = files.map((f, i) => `- [${rel(f)}](#${i + 1})`).join("\n");
    return ["# Index ", `\nIncluded Source Files (${count})`, items, "", "---"].join("\n");
}

export function renderMd(p, i) {
    const rp = rel(p);
    const ext = path.extname(p).toLowerCase();
    const lang = LANG_MAP[ext] || "txt";
    const code = readFileSafe(p).trimEnd();

    return [
        `---\n#### ${i + 1}`,
        "\n",
        "` File: " + rp + "`  [↑ Back to top](#index)",
        "",
        "```" + lang,
        code,
        "```",
        "",
    ].join("\n");
}

// TXT versions unchanged
export function tocTxt(files: string[]) {
    const sorted = [...files].sort((a, b) => a.localeCompare(b));
    return ["##==== Combined Scope ====", ...sorted.map((f) => "## - " + rel(f))].join("\n") + "\n\n";
}

export function renderTxt(p) {
    const relPath = rel(p);
    const code = readFileSafe(p);
    return ["##==== path: " + relPath + " ====", "##region " + relPath, code, "##endregion", ""].join("\n");
}
