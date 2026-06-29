import { ResolutionRequest, ResolutionIntent } from "../request/types";
import { DependencyEdge } from "./types";

export function edgesToRequests(
	edges: DependencyEdge[],
	intent: ResolutionIntent = 'dependency-edge'
): ResolutionRequest[] {
	return edges.map(edge => {
		const req: ResolutionRequest = {
			specifier: edge.specifier,
			intent,
			sourceFile: edge.sourceFile,
			sourceLanguage: edge.sourceLanguage,
			syntaxKind: edge.syntaxKind
		};

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
