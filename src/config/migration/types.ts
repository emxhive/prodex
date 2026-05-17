import type { ProdexConfigFile } from "../../types";

export interface MigrationPreview {
	needed: boolean;
	fromVersion?: number;
	toVersion: number;
	changes: string[];
	config?: ProdexConfigFile;
}

export interface MigrationCommandResult extends MigrationPreview {
	ok: boolean;
	written: boolean;
	backupPath?: string;
	path: string;
	warnings: string[];
	errors: string[];
}
