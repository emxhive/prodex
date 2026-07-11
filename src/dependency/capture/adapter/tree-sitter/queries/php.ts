import { CaptureQuery } from "../../../query/types";
import { NormalizationTable } from "../../../normalization/types";

import { classifyPhpFileSemantics } from "../../../helpers/php-file-semantics";

export const PHP_NORMALIZATION_TABLE: NormalizationTable = {
	"use.clause.name": {
		kind: "use",
		syntaxKind: "use-statement",
		isDynamic: false,
		resolveSemantics: () => ({ domain: 'symbol', resolution: 'logical' })
	},
	"use.group.clause.name": {
		kind: "use",
		syntaxKind: "grouped-use-statement",
		isDynamic: false,
		resolveSemantics: () => ({ domain: 'symbol', resolution: 'logical' })
	},
	"require.path": {
		kind: "require",
		syntaxKind: "require-literal",
		isDynamic: false,
		resolveSemantics: (specifier: string) => classifyPhpFileSemantics(specifier)
	},
	"require_once.path": {
		kind: "require",
		syntaxKind: "require-once-literal",
		isDynamic: false,
		resolveSemantics: (specifier: string) => classifyPhpFileSemantics(specifier)
	},
	"include.path": {
		kind: "include",
		syntaxKind: "include-literal",
		isDynamic: false,
		resolveSemantics: (specifier: string) => classifyPhpFileSemantics(specifier)
	},
	"include_once.path": {
		kind: "include",
		syntaxKind: "include-once-literal",
		isDynamic: false,
		resolveSemantics: (specifier: string) => classifyPhpFileSemantics(specifier)
	},
	"fq.class.new": {
		kind: "reference",
		syntaxKind: "fq-class-reference",
		isDynamic: false,
		resolveSemantics: () => ({ domain: 'symbol', resolution: 'logical' })
	},
	"fq.class.static": {
		kind: "reference",
		syntaxKind: "fq-class-reference",
		isDynamic: false,
		resolveSemantics: () => ({ domain: 'symbol', resolution: 'logical' })
	},
	"fq.class.attribute": {
		kind: "reference",
		syntaxKind: "fq-class-reference",
		isDynamic: false,
		resolveSemantics: () => ({ domain: 'symbol', resolution: 'logical' })
	},
	"fq.class.typehint": {
		kind: "reference",
		syntaxKind: "fq-class-reference",
		isDynamic: false,
		resolveSemantics: () => ({ domain: 'symbol', resolution: 'logical' })
	}
};

export const PHP_CAPTURE_QUERY: CaptureQuery = {
	languageId: "php",
	adapterId: "tree-sitter",
	patterns: [
		{ name: "use.clause.name", role: "specifier" },
		{ name: "use.group.prefix", role: "namespace" },
		{ name: "use.group.clause.name", role: "specifier" },
		{ name: "namespace.declaration", role: "namespace" },
		{ name: "require.path", role: "specifier" },
		{ name: "require_once.path", role: "specifier" },
		{ name: "include.path", role: "specifier" },
		{ name: "include_once.path", role: "specifier" },
		{ name: "fq.class.new", role: "specifier" },
		{ name: "fq.class.static", role: "specifier" },
		{ name: "fq.class.attribute", role: "specifier" },
		{ name: "fq.class.typehint", role: "specifier" }
	],
	rawQuery: `
		; Simple and aliased use statements
		(namespace_use_declaration
			(namespace_use_clause
				[
					(qualified_name)
					(name)
				] @use.clause.name))

		; Grouped use statements
		(namespace_use_declaration
			(namespace_name) @use.group.prefix
			(namespace_use_group
				(namespace_use_clause
					[
						(name)
						(qualified_name)
					] @use.group.clause.name)))

		; Namespace declaration (context)
		(namespace_definition
			name: (namespace_name) @namespace.declaration)

		; Literal require / require_once / include / include_once
		(require_expression
			(string (string_content) @require.path))

		(require_once_expression
			(string (string_content) @require_once.path))

		(include_expression
			(string (string_content) @include.path))

		(include_once_expression
			(string (string_content) @include_once.path))

		; Fully-qualified class references
		(object_creation_expression
			(qualified_name) @fq.class.new)

		(class_constant_access_expression
			(qualified_name) @fq.class.static)

		(attribute
			(qualified_name) @fq.class.attribute)

		(named_type
			(qualified_name) @fq.class.typehint)
	`,
	normalizationTable: PHP_NORMALIZATION_TABLE
};
