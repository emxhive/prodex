import type { ProdexCommandKind, ProdexRunMode } from "./app.types";

export interface FileSnapshot {
	path: string;
	content: string;
	readError?: string;
}

export interface ArtifactSection {
	id: string;
	title: string;
	kind: "text" | "code";
	language?: string;
	content: string;
}

export interface CommandOutputResult {
	command: string;
	cwd: string;
	status: "success" | "failed" | "timed-out" | "error";
	exitCode: number | null;
	signal: string | null;
	durationMs: number;
	timedOut: boolean;
	stdout: string;
	stderr: string;
	combinedOutput: string;
	errorMessage?: string;
}

export interface ArtifactMetadata {
	version: string;
	timestamp: string;
	commandKind: ProdexCommandKind;
	mode: ProdexRunMode;
	outputName?: string;
	entries: string[];
	includes: string[];
	scopeKey?: string;
	targets?: string[];
	depth?: number;
}

export interface ArtifactPayload {
	root: string;
	sections?: ArtifactSection[];
	files: FileSnapshot[];
	commandOutputs?: CommandOutputResult[];
	metadata: ArtifactMetadata;
}

export interface CommandAttachmentOptions {
	commands: string[];
	timeoutSeconds: number;
	failOnError: boolean;
}
