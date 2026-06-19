import type { LayoutOrder } from "../types";

export function getLayoutOrder(commandKind?: string): LayoutOrder {
	return commandKind === "git" ? "sections-first" : "files-first";
}

export function formatExitCode(code: number | null): string {
	return code !== null ? String(code) : "null";
}

export function formatTimeout(timedOut: boolean): string {
	return timedOut ? "yes" : "no";
}
