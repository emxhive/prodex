import { CapturedNode } from "./adapter/types";
import { CapturePattern } from "./query/types";
import { DependencyEdge, EdgeKind } from "./types";

export interface CaptureNormalizationRule {
	kind: EdgeKind;
	syntaxKind: string;
	isDynamic: boolean;
}

export type NormalizationTable = Record<string, CaptureNormalizationRule>;

export function normalizeCaptures(
	nodes: CapturedNode[],
	sourceFile: string,
	sourceLanguage: string,
	table: NormalizationTable,
	patterns: CapturePattern[] = []
): DependencyEdge[] {
	const edges: DependencyEdge[] = [];

	const roleMap = new Map<string, string>();
	for (const pattern of patterns) {
		roleMap.set(pattern.name, pattern.role);
	}

	let lastMarker: CapturedNode | null = null;

	for (const node of nodes) {
		const role = roleMap.get(node.patternName);

		if (role === 'dynamic-marker') {
			lastMarker = node;
			continue;
		}

		if (role === 'specifier' || (!role && table[node.patternName])) {
			const rule = table[node.patternName];
			if (!rule) {
				continue;
			}

			let markerPresent = false;
			if (lastMarker) {
				if (lastMarker.startPosition.line <= node.startPosition.line) {
					markerPresent = true;
				}
				lastMarker = null;
			}

			const isDynamic = rule.isDynamic || node.isDynamic || markerPresent;

			const edge: DependencyEdge = {
				specifier: node.text,
				kind: rule.kind,
				sourceFile,
				sourceLanguage,
				syntaxKind: rule.syntaxKind,
				position: node.startPosition,
				isDynamic
			};

			if (isDynamic && node.text.includes('${')) {
				edge.dynamicHint = {
					pattern: node.text,
					reason: 'template-literal'
				};
			}

			edges.push(edge);
		}
	}

	return edges;
}
