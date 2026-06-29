import { CaptureQuery } from "../../../query/types";
import { NormalizationTable } from "../../../normalization/types";

export const JAVASCRIPT_NORMALIZATION_TABLE: NormalizationTable = {
	"import.source": {
		kind: "import",
		syntaxKind: "esm-import",
		isDynamic: false
	},
	"require.argument": {
		kind: "require",
		syntaxKind: "commonjs-require",
		isDynamic: false
	}
};

export const JAVASCRIPT_CAPTURE_QUERY: CaptureQuery = {
	languageId: "javascript",
	adapterId: "tree-sitter",
	patterns: [
		{ name: "import.source", role: "specifier" },
		{ name: "require.argument", role: "specifier" }
	],
	rawQuery: `
		(import_statement source: (string (string_fragment) @import.source))
		(call_expression
			function: (identifier) @_req
			arguments: (arguments (string (string_fragment) @require.argument))
			(#eq? @_req "require"))
	`,
	normalizationTable: JAVASCRIPT_NORMALIZATION_TABLE
};
