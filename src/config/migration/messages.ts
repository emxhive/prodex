import { REQUIRED_CONFIG_VERSION } from "./detect";

const V4_CHANGES = [
	"Prodex v4 changed the config shape:",
	"  entry.files -> entry",
	"  resolve.include -> include",
	"  resolve.exclude -> exclude",
	"  resolve.depth -> resolve.maxDepth",
	"  resolve.limit -> resolve.maxFiles",
	"  shortcuts -> profiles",
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
		...V4_CHANGES,
	].join("\n");
}

export function legacyConfigShapeError(): string {
	return [
		"prodex.json contains legacy config fields that must be migrated to config version 4.",
		"",
		...V4_CHANGES,
	].join("\n");
}
