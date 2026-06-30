import { LanguageProfile } from "../detect/types";

export const TYPESCRIPT_PROFILE: LanguageProfile = {
	languageId: "typescript",
	extensions: [".ts", ".d.ts"],
	syntaxKinds: ["esm-import", "esm-export", "commonjs-require"],
	preferredAdapterId: "tree-sitter",
	bareBehavior: "external",
	extensionPriorityGroups: [
		[".ts"],
		[".tsx"],
		[".js"],
		[".jsx"]
	],
	sourceEquivMap: {
		".js": [".ts", ".tsx"],
		".jsx": [".tsx"]
	}
};
