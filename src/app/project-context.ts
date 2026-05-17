import fs from "fs";
import path from "path";
import { loadConfig, type LoadConfigResult } from "../config/load";
import type { ProdexConfigFile } from "../types";

export interface ProjectContext {
	root: string;
	config: ProdexConfigFile;
	configPath: string;
	configExists: boolean;
	warnings: string[];
	errors: string[];
}

export function loadProjectContext(rootArg?: string, cwd = process.cwd()): ProjectContext {
	const root = resolveRoot(rootArg, cwd);
	const warnings: string[] = [];
	const errors = validateRoot(root, rootArg);

	if (errors.length) {
		return {
			root,
			config: {} as ProdexConfigFile,
			configPath: path.join(root, "prodex.json"),
			configExists: false,
			warnings,
			errors,
		};
	}

	const loaded = loadConfig(root);
	return fromLoadedConfig(root, loaded);
}

export function resolveRoot(rootArg?: string, cwd = process.cwd()): string {
	return rootArg ? path.resolve(cwd, rootArg) : cwd;
}

export function validateRoot(root: string, rootArg?: string): string[] {
	if (!fs.existsSync(root)) return [`Invalid root path "${rootArg}".`];
	if (!fs.statSync(root).isDirectory()) return [`Root path "${rootArg}" is not a directory.`];
	return [];
}

function fromLoadedConfig(root: string, loaded: LoadConfigResult): ProjectContext {
	return {
		root,
		config: loaded.config,
		configPath: loaded.path,
		configExists: loaded.exists,
		warnings: [...loaded.warnings],
		errors: [...loaded.errors],
	};
}
