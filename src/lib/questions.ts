import type { QuestionSet } from "../types";

/**
 * 🧩 Centralized Inquirer question definitions.
 * Each export is a named, reusable question set.
 */

/** Ask for the output filename (used in produceOutput). */
export const OUTPUT_NAME_QUESTION: QuestionSet<{ outputBase: string }> = [
	{
		type: "input",
		name: "outputBase",
		message: "Output file name (without extension):",
		default: "combined",
		filter: (v: string) => v.trim().replace(/[<>:\"/\\|?*]+/g, "_") || "combined",
	},
];

export const PICK_ENTRIES_QUESTION = (choices: any[], depth: number): QuestionSet<{ picks: string[] }> => [
	{
		type: "checkbox",
		name: "picks",
		message: `Select entry files (depth ${depth})`,
		choices,
		loop: false,
		pageSize: 20,
	},
];
