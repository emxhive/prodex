import { rel } from "../filesystem/read-file";
import type { ArtifactPayload, CommandOutputResult } from "../types";

export function renderTxt(payload: ArtifactPayload): string {
	const root = payload.root;
	const sorted = [...payload.files].sort((a, b) => a.path.localeCompare(b.path));

	const toc = ["##==== Combined Scope ====", ...sorted.map((file) => "## - " + rel(file.path, root))].join("\n") + "\n\n";

	const sections = sorted
		.map((file) => {
			const relativePath = rel(file.path, root);
			const code = file.readError ? `Error reading file: ${file.readError}` : file.content;
			return ["##==== path: " + relativePath + " ====", "##region " + relativePath, code, "##endregion", ""].join("\n");
		})
		.join("");

	const cmdAttachments = renderTxtCmdResults(payload.commandOutputs, root);

	return [toc, sections, cmdAttachments].join("");
}

function renderTxtCmdResults(cmdResults?: CommandOutputResult[], root = process.cwd()): string {
	if (!cmdResults || cmdResults.length === 0) return "";

	const lines: string[] = ["\n##==== Command Attachments ===="];
	for (let i = 0; i < cmdResults.length; i++) {
		const res = cmdResults[i];
		const statusStr = res.status;
		lines.push(
			`## Command ${i + 1}`,
			`## - Command: ${res.command}`,
			`## - Directory: ${rel(res.cwd, root) || "."}`,
			`## - Status: ${statusStr}`,
			`## - Exit Code: ${res.exitCode !== null ? res.exitCode : "N/A"}`,
			`## - Duration: ${res.durationMs}ms`,
			`## - Timeout State: ${res.timedOut ? "Yes" : "No"}`,
			`## - Output:`
		);
		if (res.errorMessage) {
			lines.push(`## - Error Message: ${res.errorMessage}`);
		}
		lines.push(res.combinedOutput);
	}
	lines.push("##==== End Command Attachments ====\n");
	return lines.join("\n");
}
