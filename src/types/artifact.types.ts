export interface FileSnapshot {
	path: string;
	content: string;
	readError?: string;
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
	commandKind: "pack" | "trace" | "scope";
	mode: "trace" | "include-only" | "mixed";
	outputName?: string;
	entries: string[];
	includes: string[];
	scopeKey?: string;
}

export interface ArtifactPayload {
	root: string;
	files: FileSnapshot[];
	commandOutputs?: CommandOutputResult[];
	metadata: ArtifactMetadata;
}

export interface CommandAttachmentOptions {
	commands: string[];
	timeoutSeconds: number;
	failOnError: boolean;
}
