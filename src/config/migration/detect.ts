export const REQUIRED_CONFIG_VERSION = 4;

export function isOutdatedConfig(config: any): boolean {
	return typeof config?.version === "number" && config.version < REQUIRED_CONFIG_VERSION;
}

export function requiresConfigMigration(config: any): boolean {
	return isOutdatedConfig(config) || looksLikeLegacyConfig(config);
}

export function looksLikeLegacyConfig(config: any): boolean {
	return !!(
		config?.shortcuts ||
		config?.entry?.files ||
		config?.resolve?.include ||
		config?.resolve?.exclude ||
		config?.resolve?.depth ||
		config?.resolve?.limit ||
		config?.output?.prefix
	);
}
