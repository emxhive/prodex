import type { ProdexFlags } from "./cli.types";
import type { CommandAttachmentOptions } from "./artifact.types";

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
	  };

export interface ExecutionPlan {
	root: string;
	command: "pack" | "trace" | "scope";
	outputName?: string;
	entry: string[];
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
}
