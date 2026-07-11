export type DependencyOwnershipKind = "local" | "external" | "unresolved";

export type DependencyOwnershipReason =
	| "project-owned"
	| "declared-external"
	| "platform-builtin"
	| "undeclared"
	| "policy-denied"
	| "unsupported"
	| "unknown";

export interface DependencyOwnershipResult {
	kind: DependencyOwnershipKind;
	reason: DependencyOwnershipReason;
	ecosystem: string;
	specifier: string;
	specifierRoot?: string;
	sourceFile?: string;
	evidence?: unknown;
	message?: string;
}

export interface OwnershipDiagnostic {
	kind: string;
	message: string;
	ownership?: DependencyOwnershipResult;
}
