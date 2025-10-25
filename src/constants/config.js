import { resolveJsImports } from "../resolvers/js-resolver.js";
import { resolvePhpImports } from "../resolvers/php-resolver.js";


export const ROOT = process.cwd();

export const CODE_EXTS = [".js", ".mjs", ".ts", ".tsx", ".d.ts", ".php"];
export const ENTRY_EXCLUDES = [
  "resources/js/components/ui/",
  "app/Enums/",
  "app/DTOs/",
  "app/Models/",
  "app/Data/",
  "resources/js/wayfinder/",
  "resources/js/routes/",
  "resources/js/actions/",
  "resources/js/hooks/"
];
export const IMPORT_EXCLUDES = [
  "node_modules",
  "@shadcn/",
  "@/components/ui/",
  "@components/ui/",
  "resources/js/components/ui/",
  "resources/js/hooks/",
  "resources/js/wayfinder/",
  "resources/js/routes/",
  "resources/js/actions/"
];
export const BASE_DIRS = ["src", "bin", "schema", "app", "routes", "resources/js"];

export const PRIORITY_FILES = [
  "routes/web.php",
  "routes/api.php",
  "index.",
  "main.",
  "app."
]
/**
 * Resolver map — links file extensions to their resolver functions.
 * Extend this to support new formats (.vue, .jsx, etc.).
 */
export const RESOLVERS = {
  ".php": resolvePhpImports,
  ".ts": resolveJsImports,
  ".tsx": resolveJsImports,
  ".d.ts": resolveJsImports,
  ".js": resolveJsImports
};

/**
 * Prompt definitions used by Inquirer in combine.js.
 * These are constants to keep UI consistent across releases.
 */
export const PROMPTS = {
  yesToAll: {
    type: "confirm",
    name: "yesToAll",
    message: "Proceed automatically with default settings (Yes to all)?",
    default: true
  },
  combine: [
    {
      type: "input",
      name: "outputBase",
      message: "Output base name (without extension):",
      default: null, // will be set dynamically
      filter: v => v.trim()
    },
    {
      type: "number",
      name: "limit",
      message: "Limit number of merged files:",
      default: 200, // will be overridden at runtime
      validate: v => (!isNaN(v) && v > 0) || "Enter a valid positive number"
    },
    {
      type: "confirm",
      name: "chain",
      message: "Follow dependency chain?",
      default: true
    },
    {
      type: "confirm",
      name: "proceed",
      message: "Proceed with combine?",
      default: true
    }
  ]
};
