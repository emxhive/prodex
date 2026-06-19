import type { ArtifactPayload } from "./artifact.types";

export type LayoutOrder = "files-first" | "sections-first";

export interface MdTraceEntry {
	file: string;
	anchor: number;
	startLine: number;
	endLine: number;
}

export interface OutputParams {
	name: string;
	payload: ArtifactPayload;
	format: "md" | "txt";
	dir: string;
	versioned: boolean;
}


