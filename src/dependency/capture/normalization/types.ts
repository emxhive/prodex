import { EdgeKind } from "../types";
import { ReferenceSemantics } from "../../types/reference-semantics";

export interface CaptureNormalizationRule {
	kind: EdgeKind;
	syntaxKind: string;
	isDynamic: boolean;
	resolveSemantics?: (specifier: string) => ReferenceSemantics;
}

export type NormalizationTable = Record<string, CaptureNormalizationRule>;
