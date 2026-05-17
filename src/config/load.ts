import fs from "fs";
import path from "path";
import { DEFAULT_PRODEX_CONFIG } from "../constants";
import type { ProdexConfigFile } from "../types";
import { configVersionError, isOutdatedConfig, legacyConfigShapeError, requiresConfigMigration } from "./migrate";
import { parseJsonFile } from "./json";

export interface LoadConfigResult {
	config: ProdexConfigFile;
	path: string;
	warnings: string[];
	errors: string[];
	exists: boolean;
}

export function loadConfig(root: string): LoadConfigResult {
	const configPath = path.join(root, "prodex.json");
	const warnings: string[] = [];
	const errors: string[] = [];

	if (!fs.existsSync(configPath)) {
		return {
			config: DEFAULT_PRODEX_CONFIG,
			path: configPath,
			warnings,
			errors,
			exists: false,
		};
	}

	try {
		const parsed = parseJsonFile(fs.readFileSync(configPath, "utf8")) as ProdexConfigFile;
		if (requiresConfigMigration(parsed)) {
			errors.push(isOutdatedConfig(parsed) ? configVersionError((parsed as any).version) : legacyConfigShapeError());
		}
		return {
			config: parsed,
			path: configPath,
			warnings,
			errors,
			exists: true,
		};
	} catch (err: any) {
		errors.push(`Invalid prodex.json: ${err?.message || err}`);
		return {
			config: DEFAULT_PRODEX_CONFIG,
			path: configPath,
			warnings,
			errors,
			exists: true,
		};
	}
}
