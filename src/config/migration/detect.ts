export const REQUIRED_CONFIG_VERSION = 5;

export function isOutdatedConfig(config: any): boolean {
	return typeof config?.version === "number" && config.version < REQUIRED_CONFIG_VERSION;
}

export function isFutureConfig(config: any): boolean {
	return typeof config?.version === "number" && config.version > REQUIRED_CONFIG_VERSION;
}

export function requiresConfigMigration(config: any): boolean {
	return isOutdatedConfig(config) || looksLikeLegacyConfig(config);
}

export function looksLikeLegacyConfig(config: any): boolean {
	return !!(
		config?.profiles ||
		config?.resolve ||
		config?.shortcuts ||
		config?.entry !== undefined ||
		config?.include !== undefined ||
		config?.entry?.files ||
		config?.resolve?.include ||
		config?.resolve?.exclude ||
		config?.resolve?.depth ||
		config?.resolve?.limit ||
		config?.output?.prefix
	);
}
