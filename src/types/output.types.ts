import type { ArtifactPayload } from "./artifact.types";

export interface OutputParams {
	name: string;
	payload: ArtifactPayload;
	format: "md" | "txt";
	dir: string;
	versioned: boolean;
}
