import type { ProdexFlags } from "./cli.types";
import type { CommandAttachmentOptions } from "./artifact.types";
import type { ProdexCommandKind } from "./app.types";

export type CommandIntent =
	| {
			kind: "pack";
			rootArg?: string;
			flags: Partial<ProdexFlags>;
	  }
	| {
			kind: "trace";
			rootArg?: string;
			flags: Partial<ProdexFlags>;
	  }
	| {
			kind: "scope";
			rootArg?: string;
			flags: Partial<ProdexFlags>;
	  }
	| {
			kind: "git";
			rootArg?: string;
			flags: Partial<ProdexFlags>;
	  }
	| {
			kind: "grep";
			rootArg?: string;
			flags: Partial<ProdexFlags>;
	  };

export type GitPlanOptions =
	| {
			mode: "working-tree";
			changed: boolean;
			staged: boolean;
			unstaged: boolean;
			untracked: boolean;
			includeDiff: boolean;
	  }
	| {
			mode: "commit";
			rev: string;
			includeDiff: boolean;
	  }
	| {
			mode: "range";
			spec: string;
			base: string;
			head: string;
			includeDiff: boolean;
	  }
	| {
			mode: "against";
			base: string;
			mergeBase?: string; // resolved later
			includeDiff: boolean;
	  };


export interface GrepPlanOptions {
	mode: "query" | "any" | "all" | "regex";
	terms: string[];
	negativeTerms: string[];
	within: string[];
	skip: string[];
}

export interface ExecutionPlan {
	root: string;
	command: ProdexCommandKind;
	outputName?: string;
	entry: string[];
	target?: string[];
	include: string[];
	exclude: string[];
	depth: number;
	maxFiles: number;
	aliases: Record<string, string>;
	output: {
		dir: string;
		versioned: boolean;
		format: "md" | "txt";
	};
	dryRun: boolean;
	scopeKey?: string;
	attachmentOptions?: CommandAttachmentOptions;
	gitOptions?: GitPlanOptions;
	grepOptions?: GrepPlanOptions;
}
