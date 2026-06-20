import fs from "fs";
import path from "path";
import { DEFAULT_PRODEX_CONFIG } from "./default-config";
import type { ProdexConfigFile } from "../types";
import {
	configVersionError,
	isOutdatedConfig,
	isFutureConfig,
	legacyConfigShapeError,
	requiresConfigMigration,
	REQUIRED_CONFIG_VERSION,
} from "./migration";
import { parseJsonFile } from "./json";

export interface LoadConfigResult {
	config: ProdexConfigFile;
	path: string;
	warnings: string[];
	errors: string[];
	exists: boolean;
}

function cloneDefaultConfig(): ProdexConfigFile {
	return JSON.parse(JSON.stringify(DEFAULT_PRODEX_CONFIG));
}

export function validateConfig(config: any): string[] {
	const errors: string[] = [];
	if (!config || typeof config !== "object") {
		errors.push("Configuration must be a JSON object.");
		return errors;
	}

	if (config.version === undefined) {
		errors.push("Config 'version' is required.");
	} else if (config.version !== 5) {
		errors.push("Config 'version' must equal 5.");
	}

	if (config.output !== undefined) {
		if (typeof config.output !== "object" || config.output === null || Array.isArray(config.output)) {
			errors.push("Config 'output' must be an object.");
		} else {
			const allowedOutputKeys = new Set(["dir", "versioned", "format"]);
			for (const key of Object.keys(config.output)) {
				if (!allowedOutputKeys.has(key)) {
					errors.push(`Config 'output' contains unknown key '${key}'.`);
				}
			}
			if (config.output.dir !== undefined && typeof config.output.dir !== "string") {
				errors.push("Config 'output.dir' must be a string.");
			}
			if (config.output.versioned !== undefined && typeof config.output.versioned !== "boolean") {
				errors.push("Config 'output.versioned' must be a boolean.");
			}
			if (config.output.format !== undefined && config.output.format !== "md" && config.output.format !== "txt") {
				errors.push("Config 'output.format' must be either 'md' or 'txt'.");
			}
		}
	}

	if (config.exclude !== undefined) {
		if (!Array.isArray(config.exclude)) {
			errors.push("Config 'exclude' must be an array.");
		} else {
			for (let i = 0; i < config.exclude.length; i++) {
				if (typeof config.exclude[i] !== "string") {
					errors.push(`Config 'exclude[${i}]' must be a string.`);
				}
			}
		}
	}

	if (config.aliases !== undefined) {
		if (typeof config.aliases !== "object" || config.aliases === null || Array.isArray(config.aliases)) {
			errors.push("Config 'aliases' must be an object.");
		} else {
			for (const [key, val] of Object.entries(config.aliases)) {
				if (typeof val !== "string") {
					errors.push(`Config 'aliases.${key}' must be a string.`);
				}
			}
		}
	}

	if (config.depth !== undefined) {
		if (typeof config.depth !== "number" || !Number.isInteger(config.depth) || config.depth < 0) {
			errors.push("Config --depth must be an integer greater than or equal to 0.");
		}
	}

	if (config.maxFiles !== undefined) {
		if (typeof config.maxFiles !== "number" || !Number.isInteger(config.maxFiles) || config.maxFiles <= 0) {
			errors.push("Config --max-files must be an integer greater than 0.");
		}
	}

	if (config.scopes !== undefined) {
		if (typeof config.scopes !== "object" || config.scopes === null || Array.isArray(config.scopes)) {
			errors.push("Config 'scopes' must be an object.");
		} else {
			for (const [scopeKey, scopeVal] of Object.entries(config.scopes)) {
				const scope = scopeVal as any;
				if (typeof scope !== "object" || scope === null || Array.isArray(scope)) {
					errors.push(`Config 'scopes.${scopeKey}' must be an object.`);
				} else {
					const allowedScopeKeys = new Set(["name", "entry", "include", "exclude", "grep"]);
					for (const key of Object.keys(scope)) {
						if (!allowedScopeKeys.has(key)) {
							errors.push(`Config 'scopes.${scopeKey}' contains unknown key '${key}'.`);
						}
					}
					if (scope.name !== undefined && typeof scope.name !== "string") {
						errors.push(`Config 'scopes.${scopeKey}.name' must be a string.`);
					}
					if (scope.entry !== undefined) {
						if (!Array.isArray(scope.entry)) {
							errors.push(`Config 'scopes.${scopeKey}.entry' must be an array.`);
						} else {
							for (let i = 0; i < scope.entry.length; i++) {
								if (typeof scope.entry[i] !== "string") {
									errors.push(`Config 'scopes.${scopeKey}.entry[${i}]' must be a string.`);
								}
							}
						}
					}
					if (scope.include !== undefined) {
						if (!Array.isArray(scope.include)) {
							errors.push(`Config 'scopes.${scopeKey}.include' must be an array.`);
						} else {
							for (let i = 0; i < scope.include.length; i++) {
								if (typeof scope.include[i] !== "string") {
									errors.push(`Config 'scopes.${scopeKey}.include[${i}]' must be a string.`);
								}
							}
						}
					}
					if (scope.exclude !== undefined) {
						if (!Array.isArray(scope.exclude)) {
							errors.push(`Config 'scopes.${scopeKey}.exclude' must be an array.`);
						} else {
							for (let i = 0; i < scope.exclude.length; i++) {
								if (typeof scope.exclude[i] !== "string") {
									errors.push(`Config 'scopes.${scopeKey}.exclude[${i}]' must be a string.`);
								}
							}
						}
					}
					if (scope.grep !== undefined) {
						if (typeof scope.grep !== "object" || scope.grep === null || Array.isArray(scope.grep)) {
							errors.push(`Config 'scopes.${scopeKey}.grep' must be an object.`);
						} else {
							const allowedGrepKeys = new Set(["query", "any", "all", "regex", "not", "within", "skip"]);
							for (const key of Object.keys(scope.grep)) {
								if (!allowedGrepKeys.has(key)) {
									errors.push(`Config 'scopes.${scopeKey}.grep' contains unknown key '${key}'.`);
								}
							}
							if (scope.entry !== undefined) {
								errors.push(`Scope "${scopeKey}" cannot define both "entry" and "grep".`);
							}
							const searchModes = ["query", "any", "all", "regex"];
							const definedModes = searchModes.filter(m => scope.grep[m] !== undefined);
							if (definedModes.length !== 1) {
								errors.push(`Scope "${scopeKey}" grep config must define exactly one of "query", "any", "all", or "regex".`);
							}

							if (scope.grep.query !== undefined) {
								if (typeof scope.grep.query !== "string") {
									errors.push(`Config 'scopes.${scopeKey}.grep.query' must be a string.`);
								} else if (!scope.grep.query.trim()) {
									errors.push(`Config 'scopes.${scopeKey}.grep.query' cannot be blank.`);
								}
							}
							if (scope.grep.regex !== undefined) {
								if (typeof scope.grep.regex !== "string") {
									errors.push(`Config 'scopes.${scopeKey}.grep.regex' must be a string.`);
								} else if (!scope.grep.regex.trim()) {
									errors.push(`Config 'scopes.${scopeKey}.grep.regex' cannot be blank.`);
								}
							}
							if (scope.grep.any !== undefined) {
								if (!Array.isArray(scope.grep.any)) {
									errors.push(`Config 'scopes.${scopeKey}.grep.any' must be an array.`);
								} else if (scope.grep.any.length === 0) {
									errors.push(`Config 'scopes.${scopeKey}.grep.any' must contain at least one item.`);
								} else {
									for (let i = 0; i < scope.grep.any.length; i++) {
										if (typeof scope.grep.any[i] !== "string") {
											errors.push(`Config 'scopes.${scopeKey}.grep.any[${i}]' must be a string.`);
										} else if (!scope.grep.any[i].trim()) {
											errors.push(`Config 'scopes.${scopeKey}.grep.any[${i}]' cannot be blank.`);
										}
									}
								}
							}
							if (scope.grep.all !== undefined) {
								if (!Array.isArray(scope.grep.all)) {
									errors.push(`Config 'scopes.${scopeKey}.grep.all' must be an array.`);
								} else if (scope.grep.all.length === 0) {
									errors.push(`Config 'scopes.${scopeKey}.grep.all' must contain at least one item.`);
								} else {
									for (let i = 0; i < scope.grep.all.length; i++) {
										if (typeof scope.grep.all[i] !== "string") {
											errors.push(`Config 'scopes.${scopeKey}.grep.all[${i}]' must be a string.`);
										} else if (!scope.grep.all[i].trim()) {
											errors.push(`Config 'scopes.${scopeKey}.grep.all[${i}]' cannot be blank.`);
										}
									}
								}
							}
							if (scope.grep.not !== undefined) {
								if (!Array.isArray(scope.grep.not)) {
									errors.push(`Config 'scopes.${scopeKey}.grep.not' must be an array.`);
								} else {
									for (let i = 0; i < scope.grep.not.length; i++) {
										if (typeof scope.grep.not[i] !== "string") {
											errors.push(`Config 'scopes.${scopeKey}.grep.not[${i}]' must be a string.`);
										} else if (!scope.grep.not[i].trim()) {
											errors.push(`Config 'scopes.${scopeKey}.grep.not[${i}]' cannot be blank.`);
										}
									}
								}
							}
							if (scope.grep.within !== undefined) {
								if (!Array.isArray(scope.grep.within)) {
									errors.push(`Config 'scopes.${scopeKey}.grep.within' must be an array.`);
								} else {
									for (let i = 0; i < scope.grep.within.length; i++) {
										if (typeof scope.grep.within[i] !== "string") {
											errors.push(`Config 'scopes.${scopeKey}.grep.within[${i}]' must be a string.`);
										} else if (!scope.grep.within[i].trim()) {
											errors.push(`Config 'scopes.${scopeKey}.grep.within[${i}]' cannot be blank.`);
										}
									}
								}
							}
							if (scope.grep.skip !== undefined) {
								if (!Array.isArray(scope.grep.skip)) {
									errors.push(`Config 'scopes.${scopeKey}.grep.skip' must be an array.`);
								} else {
									for (let i = 0; i < scope.grep.skip.length; i++) {
										if (typeof scope.grep.skip[i] !== "string") {
											errors.push(`Config 'scopes.${scopeKey}.grep.skip[${i}]' must be a string.`);
										} else if (!scope.grep.skip[i].trim()) {
											errors.push(`Config 'scopes.${scopeKey}.grep.skip[${i}]' cannot be blank.`);
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}

	const allowedRootKeys = new Set(["$schema", "version", "output", "exclude", "aliases", "depth", "maxFiles", "scopes"]);
	for (const key of Object.keys(config)) {
		if (!allowedRootKeys.has(key)) {
			errors.push(`Config contains unknown root key '${key}'.`);
		}
	}

	return errors;
}

export function loadConfig(root: string): LoadConfigResult {
	const configPath = path.join(root, "prodex.json");
	const warnings: string[] = [];
	const errors: string[] = [];

	if (!fs.existsSync(configPath)) {
		return {
			config: cloneDefaultConfig(),
			path: configPath,
			warnings,
			errors,
			exists: false,
		};
	}

	try {
		const parsed = parseJsonFile(fs.readFileSync(configPath, "utf8")) as ProdexConfigFile;
		if (isFutureConfig(parsed)) {
			errors.push(`prodex.json uses future config version ${parsed.version}, but this Prodex version only supports up to config version ${REQUIRED_CONFIG_VERSION}.`);
		} else if (requiresConfigMigration(parsed)) {
			errors.push(isOutdatedConfig(parsed) ? configVersionError((parsed as any).version) : legacyConfigShapeError());
		} else {
			const validationErrors = validateConfig(parsed);
			errors.push(...validationErrors);
		}
		return {
			config: errors.length > 0 ? cloneDefaultConfig() : parsed,
			path: configPath,
			warnings,
			errors,
			exists: true,
		};
	} catch (err: any) {
		errors.push(`Invalid prodex.json: ${err?.message || err}`);
		return {
			config: cloneDefaultConfig(),
			path: configPath,
			warnings,
			errors,
			exists: true,
		};
	}
}
