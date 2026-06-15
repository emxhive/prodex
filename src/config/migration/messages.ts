import { REQUIRED_CONFIG_VERSION } from "./detect";

const V5_CHANGES = [
	"Prodex v5 changed the config shape:",
	"  entry -> scopes.default.entry",
	"  include -> scopes.default.include",
	"  profiles -> scopes",
	"  profiles.*.name -> scopes.*.name",
	"  resolve.aliases -> aliases",
	"  resolve.maxDepth -> depth",
	"  resolve.maxFiles -> maxFiles",
	"",
	"Preview migration:",
	"  prodex migrate",
	"",
	"Update prodex.json:",
	"  prodex migrate --write",
];

export function configVersionError(version: unknown): string {
	const label = typeof version === "number" ? String(version) : "an older format";
	return [
		`prodex.json uses config version ${label}, but this Prodex version requires config version ${REQUIRED_CONFIG_VERSION}.`,
		"",
		...V5_CHANGES,
	].join("\n");
}

export function legacyConfigShapeError(): string {
	return [
		"prodex.json contains legacy config fields that must be migrated to config version 5.",
		"",
		...V5_CHANGES,
	].join("\n");
}
