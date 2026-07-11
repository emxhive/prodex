import { CaptureQuery } from "../../../query/types";
import { NormalizationTable } from "../../../normalization/types";

import { classifyJsTsModuleSemantics } from "../../../helpers/js-ts-semantics";

export const TYPESCRIPT_NORMALIZATION_TABLE: NormalizationTable = {
	"import.source": {
		kind: "import",
		syntaxKind: "esm-import",
		isDynamic: false,
		resolveSemantics: (specifier: string) => classifyJsTsModuleSemantics(specifier)
	},
	"export.source": {
		kind: "import",
		syntaxKind: "esm-export",
		isDynamic: false,
		resolveSemantics: (specifier: string) => classifyJsTsModuleSemantics(specifier)
	},
	"import.dynamic": {
		kind: "import",
		syntaxKind: "dynamic-import",
		isDynamic: true
	},
	"require.argument": {
		kind: "require",
		syntaxKind: "commonjs-require",
		isDynamic: false,
		resolveSemantics: (specifier: string) => classifyJsTsModuleSemantics(specifier)
	}
};

export const TYPESCRIPT_CAPTURE_QUERY: CaptureQuery = {
	languageId: "typescript",
	adapterId: "tree-sitter",
	patterns: [
		{ name: "import.source", role: "specifier" },
		{ name: "export.source", role: "specifier" },
		{ name: "import.dynamic", role: "specifier" },
		{ name: "require.argument", role: "specifier" }
	],
	rawQuery: `
		(import_statement source: (string (string_fragment) @import.source))
		(export_statement source: (string (string_fragment) @export.source))
		(call_expression
			function: (import)
			arguments: (arguments (string (string_fragment) @import.dynamic)))
		(call_expression
			function: (identifier) @_req
			arguments: (arguments (string (string_fragment) @require.argument))
			(#eq? @_req "require"))
		(import_require_clause source: (string (string_fragment) @import.source))
	`,
	normalizationTable: TYPESCRIPT_NORMALIZATION_TABLE
};
