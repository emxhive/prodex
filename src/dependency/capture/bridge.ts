import { ResolutionRequest, ResolutionIntent } from "../request/types";
import { DependencyEdge } from "./types";
import { LanguageProfile } from "./detect/types";

export interface EdgesToRequestsOptions {
	intent?: ResolutionIntent;
	profile?: LanguageProfile;
	aliases?: Record<string, string>;
}

export function edgesToRequests(
	edges: DependencyEdge[],
	intentOrOptions?: ResolutionIntent | EdgesToRequestsOptions
): ResolutionRequest[] {
	let intent: ResolutionIntent = "dependency-edge";
	let profile: LanguageProfile | undefined = undefined;
	let aliases: Record<string, string> | undefined = undefined;

	if (typeof intentOrOptions === "string") {
		intent = intentOrOptions;
	} else if (intentOrOptions && typeof intentOrOptions === "object") {
		if (intentOrOptions.intent) intent = intentOrOptions.intent;
		if (intentOrOptions.profile) profile = intentOrOptions.profile;
		if (intentOrOptions.aliases) aliases = intentOrOptions.aliases;
	}

	return edges.map(edge => {
		const req: ResolutionRequest = {
			specifier: edge.specifier,
			intent,
			sourceFile: edge.sourceFile,
			sourceLanguage: edge.sourceLanguage,
			syntaxKind: edge.syntaxKind
		};

		if (profile) {
			req.profile = profile;
		}

		if (aliases) {
			req.aliases = aliases;
		}

		if (edge.position) {
			req.origin = {
				path: edge.sourceFile,
				position: {
					line: edge.position.line,
					column: edge.position.column
				}
			};
		} else {
			req.origin = {
				path: edge.sourceFile
			};
		}

		return req;
	});
}
