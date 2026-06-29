import { CapturedNode } from "../adapter/types";
import { DependencyEdge } from "../types";
import { NormalizationTable } from "./types";
import { CapturePattern } from "../query/types";

export interface NormalizedPhpResult {
	edges: DependencyEdge[];
	namespaceContext?: string;
}

export function normalizePhpCaptures(
	nodes: CapturedNode[],
	sourceFile: string,
	table: NormalizationTable,
	patterns: CapturePattern[] = []
): NormalizedPhpResult {
	const edges: DependencyEdge[] = [];
	let namespaceContext: string | undefined = undefined;

	// 1. First pass: find the namespace declaration and prefix map for grouped uses
	const prefixMap = new Map<number, string>();
	for (const node of nodes) {
		if (node.patternName === "namespace.declaration") {
			if (!namespaceContext) {
				namespaceContext = node.text;
			}
		} else if (node.patternName === "use.group.prefix") {
			const tsNode = node.node as any;
			const declNode = tsNode?.parent;
			if (declNode && declNode.type === "namespace_use_declaration") {
				prefixMap.set(declNode.id, node.text);
			}
		}
	}

	// 2. Second pass: normalize specifiers and build edges
	for (const node of nodes) {
		const rule = table[node.patternName];
		if (!rule) {
			continue;
		}

		// Check use function / use const exclusion and skip aliases
		if (node.patternName === "use.clause.name" || node.patternName === "use.group.clause.name") {
			if (isPhpUseExcluded(node) || isPhpAlias(node)) {
				continue;
			}
		}

		let specifier = node.text;

		// Grouped use prefix stitching
		if (node.patternName === "use.group.clause.name") {
			const tsNode = node.node as any;
			let declNode = tsNode?.parent;
			while (declNode && declNode.type !== "namespace_use_declaration") {
				declNode = declNode.parent;
			}
			if (declNode) {
				const prefix = prefixMap.get(declNode.id);
				if (prefix) {
					specifier = `${prefix}\\${specifier}`;
				}
			}
		}

		// Leading slash normalization for FQCNs
		if (specifier.startsWith("\\")) {
			specifier = specifier.slice(1);
		}

		const edge: DependencyEdge = {
			specifier,
			kind: rule.kind,
			sourceFile,
			sourceLanguage: "php",
			syntaxKind: rule.syntaxKind,
			position: node.startPosition,
			isDynamic: rule.isDynamic || node.isDynamic
		};

		edges.push(edge);
	}

	return { edges, namespaceContext };
}

function isPhpUseExcluded(node: CapturedNode): boolean {
	const tsNode = node.node as any;
	if (!tsNode) return false;

	// Check if parent (namespace_use_clause) has type 'function' or 'const'
	const parent = tsNode.parent;
	if (parent && parent.type === "namespace_use_clause") {
		const typeChild = parent.childForFieldName("type");
		if (typeChild && (typeChild.type === "function" || typeChild.type === "const")) {
			return true;
		}
	}

	// Check if ancestor namespace_use_declaration or namespace_use_group has type 'function' or 'const'
	let ancestor = parent;
	while (ancestor) {
		if (ancestor.type === "namespace_use_declaration" || ancestor.type === "namespace_use_group") {
			const typeChild = ancestor.childForFieldName("type");
			if (typeChild && (typeChild.type === "function" || typeChild.type === "const")) {
				return true;
			}
		}
		ancestor = ancestor.parent;
	}

	return false;
}

function isPhpAlias(node: CapturedNode): boolean {
	const tsNode = node.node as any;
	if (!tsNode) return false;

	const parent = tsNode.parent;
	if (parent && parent.type === "namespace_use_clause") {
		const aliasNode = parent.childForFieldName("alias");
		if (aliasNode && aliasNode.id === tsNode.id) {
			return true;
		}
	}
	return false;
}
