import { EdgeKind } from "../types";

export interface CaptureNormalizationRule {
	kind: EdgeKind;
	syntaxKind: string;
	isDynamic: boolean;
}

export type NormalizationTable = Record<string, CaptureNormalizationRule>;
