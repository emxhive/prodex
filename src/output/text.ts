import { rel } from "../filesystem/read-file";
import type { ArtifactPayload, CommandOutputResult, ArtifactSection } from "../types";

export function renderTxt(payload: ArtifactPayload): string {
	const root = payload.root;
	const sorted = [...payload.files].sort((a, b) => a.path.localeCompare(b.path));

	const contextLines: string[] = [];
	if (payload.metadata?.commandKind === "trace" && payload.metadata.targets && payload.metadata.targets.length > 0) {
		const relativeEntries = payload.metadata.entries.map(e => rel(e, root));
		contextLines.push(
			"##==== Trace Target Context ====",
			`## - Requested Target(s): ${payload.metadata.targets.join(", ")}`,
			`## - Resolved Starting Point(s): ${relativeEntries.join(", ") || "none"}`,
			`## - Traversal Depth: ${payload.metadata.depth !== undefined ? payload.metadata.depth : "none"}`,
			""
		);
	}

	const isGit = payload.metadata?.commandKind === "git";
	const isFileFirst = !isGit;

	const sectionToc = (payload.sections ?? []).map((sec) => "## - Section: " + sec.title);
	const fileToc = sorted.map((file) => "## - File: " + rel(file.path, root));
	const tocParts = isFileFirst ? [...fileToc, ...sectionToc] : [...sectionToc, ...fileToc];
	const toc = ["##==== Combined Scope ====", ...contextLines, ...tocParts].join("\n") + "\n\n";

	const genericSections = (payload.sections ?? [])
		.map((sec) => {
			return ["##==== section: " + sec.title + " ====", "##region " + sec.title, sec.content, "##endregion", ""].join("\n");
		})
		.join("");

	const fileSections = sorted
		.map((file) => {
			const relativePath = rel(file.path, root);
			const code = file.readError ? `Error reading file: ${file.readError}` : file.content;
			return ["##==== path: " + relativePath + " ====", "##region " + relativePath, code, "##endregion", ""].join("\n");
		})
		.join("");

	const cmdAttachments = renderTxtCmdResults(payload.commandOutputs, root);

	const bodyParts = isFileFirst
		? [toc, fileSections, cmdAttachments, genericSections]
		: [toc, genericSections, fileSections, cmdAttachments];

	return bodyParts.join("");
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
