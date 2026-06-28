import { ResolutionResult } from "../request/types";

export type StrategyOutcome =
	| { type: "final"; result: ResolutionResult }
	| { type: "no-decision"; reason?: string };
