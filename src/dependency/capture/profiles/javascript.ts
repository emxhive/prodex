import { LanguageProfile } from "../detect/types";

export const JAVASCRIPT_PROFILE: LanguageProfile = {
	languageId: "javascript",
	extensions: [".js", ".mjs", ".cjs"],
	syntaxKinds: ["esm-import", "commonjs-require"],
	preferredAdapterId: "tree-sitter",
	bareBehavior: "external",
	extensionPriorityGroups: [
		[".js"],
		[".ts"],
		[".jsx"],
		[".tsx"]
	],
	sourceEquivMap: {
		".js": [".ts", ".tsx", ".jsx"]
	}
};
