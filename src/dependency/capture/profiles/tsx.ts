import { LanguageProfile } from "../detect/types";

export const TSX_PROFILE: LanguageProfile = {
	languageId: "tsx",
	extensions: [".tsx"],
	syntaxKinds: ["esm-import", "esm-export", "commonjs-require"],
	preferredAdapterId: "tree-sitter",
	bareBehavior: "external",
	extensionPriorityGroups: [
		[".tsx"],
		[".ts"],
		[".jsx"],
		[".js"]
	],
	sourceEquivMap: {
		".js": [".tsx", ".ts"],
		".jsx": [".tsx"]
	}
};
