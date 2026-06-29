import { LanguageProfile } from "../detect/types";

export const PHP_PROFILE: LanguageProfile = {
	languageId: "php",
	extensions: [".php"],
	syntaxKinds: [
		"use-statement",
		"grouped-use-statement",
		"require-literal",
		"require-once-literal",
		"include-literal",
		"include-once-literal",
		"fq-class-reference"
	],
	preferredAdapterId: "tree-sitter",
	bareBehavior: "unresolvable",
	extensionPriorityGroups: [
		[".php"]
	]
};
