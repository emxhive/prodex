import inquirer from "inquirer";
import { logger } from "./logger";
import type { QuestionSet } from "../types";

/**
 * 🧩 prompt()
 * Unified and safe wrapper for inquirer.prompt()
 *
 * - Requires explicit `showUi` flag (no env auto-detection).
 * - Returns `null` or `fallback` on failure or disabled UI.
 * - Handles TTY errors and user cancellations gracefully.
 */
export async function prompt<T = any>(questions: QuestionSet<T>, fallback?: T): Promise<T | null> {
	try {
		const answers = (await inquirer.prompt<T>(questions as any)) as T;
		return answers;
	} catch (err: any) {
		if (err?.isTtyError) {
			logger.warn("Interactive prompts not supported (no TTY).");
		} else if (/canceled|aborted/i.test(err?.message)) {
			logger.warn("Prompt canceled by user.");
		} else {
			logger.error("Prompt failed:", err.message || err);
		}
		return fallback ?? null;
	}
}
