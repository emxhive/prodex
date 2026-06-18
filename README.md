# Prodex

Focused code-context extraction for large, multi-file projects.

Prodex starts from real project entrypoints, follows supported dependencies, adds explicitly included files, and exports a clean Markdown trace. It helps you isolate the files that matter for a feature, review, debug session, documentation pass, handoff, or AI-assisted workflow without manually collecting every related file.

Prodex is intentionally narrow: it creates readable, reproducible context bundles. It is not trying to be a full IDE indexer, static analysis platform, architecture rule engine, or graph visualizer.

## Why Prodex

Large projects make context gathering expensive. A feature can start in one route or component, then spread through shared utilities, types, controllers, services, bindings, and framework conventions. Copying those files by hand is slow, inconsistent, and easy to get wrong.

Prodex gives that workflow a repeatable shape:

1. Choose one or more entry files or globs.
2. Trace the dependencies Prodex can resolve.
3. Add any extra files you explicitly include.
4. Exclude noisy paths such as generated output, vendor code, or UI primitives.
5. Export a Markdown bundle with an index and file sections.

The result is a focused project trace you can read, share, review, archive, or hand to another tool.

## How It Works

```bash
prodex pack --entry src/index.ts
```

Prodex resolves the requested entrypoints from your project root, follows supported dependency references, applies include and exclude rules, then writes a versioned Markdown file to `./prodex/` by default.

For example:

```bash
prodex pack --entry resources/js/pages/Dashboard.tsx --include "routes/web.php"
```

This traces the dashboard entrypoint and adds the matching route file to the exported context.

## Scopes

Scopes are reusable configured slices of your codebase stored in `prodex.json`.

They are one of Prodex's most useful features: instead of rebuilding the same trace commands every time, teams can save important project areas as named scopes such as `dashboard`, `auth`, `billing`, `api`, `admin`, or `checkout`.

* **scope key**: Lookup identity used in CLI selection (e.g. `dashboard` in `scopes.dashboard`).
* **scope.name**: Configured output/display name used for output files (e.g., `frontend-dashboard`). If not provided, the scope key is used.

CLI selection uses the scope key:

```bash
prodex scope -k dashboard
prodex scope -k auth,billing
prodex scope --all
prodex scope --list
```

Use scopes when a project has recurring review surfaces or ownership areas. Run one scope, a comma-separated set of scopes, or all scopes with `--all` when you need a broader pass.

Example v5 configuration file:

```json
{
  "version": 5,
  "$schema": "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
  "output": {
    "dir": "prodex",
    "format": "md",
    "versioned": true
  },
  "exclude": ["node_modules/**", "vendor/**", "dist/**"],
  "aliases": {
    "@": "resources/js"
  },
  "depth": 10,
  "maxFiles": 200,
  "scopes": {
    "dashboard": {
      "name": "frontend-dashboard",
      "entry": ["resources/js/pages/Dashboard.tsx"],
      "include": ["routes/web.php"],
      "exclude": ["resources/js/components/ui/**"]
    }
  }
}
```

## Markdown Output

Markdown is the primary Prodex output.

Each generated trace includes:

- A file index
- A total file count marker
- Links to each exported file section
- Line ranges for the generated sections
- Syntax-highlighted code fences where possible
- The collected source content in one readable bundle

Versioned filenames are enabled by default so repeated runs do not overwrite earlier traces.

## Current Support

Prodex's broader identity is controlled context extraction, not a single-framework tool.

Include-only extraction is language-agnostic: any source or text file matched by `--include` or a scope `include` rule can be added to a trace.

Dependency tracing is resolver-based. Today Prodex traces JavaScript, TypeScript, TSX, declaration files, and PHP entrypoints. Current tracing support includes JS/TS imports, dynamic imports, CommonJS `require`, re-exports, static PHP include/require statements, PHP namespace imports, PSR-4 resolution, and some Laravel binding awareness.

Unsupported or dynamic relationships may need to be added with `--include` or scope `include` rules. That is expected: Prodex favors a focused, readable trace over pretending to understand every runtime edge in a project.

## Installation

```bash
npm install -g prodex
```

Or run it ad hoc:

```bash
npx prodex pack --entry src/index.ts
```

Create a starter config:

```bash
prodex init
```

## Common Commands

```bash
prodex pack [root] -e src/index.ts -i README.md -n review
prodex pack [root] --scope dashboard -n dashboard-review
prodex trace [root] -t src/index.ts --depth 2
prodex scope [root] -k dashboard
prodex scope [root] --all
prodex scope [root] --list
prodex git [root] --changed
prodex grep [root] --query "database"
prodex migrate [root]
prodex migrate [root] --check
prodex migrate [root] --write
```

## CLI Reference

### `pack` Command

Generate a single merged context pack.

| Flag | Short | Type | Description |
| --- | --- | --- | --- |
| `--entry` | `-e` | list | Entry file or glob to trace. Repeatable and comma-aware. |
| `--include` | `-i` | list | Extra file or glob to add without dependency tracing. Repeatable and comma-aware. |
| `--exclude` | `-x` | list | File or glob to skip. Repeatable and comma-aware. |
| `--scope` | `-s` | list | Merge a configured scope's files by scope key. Comma-aware and repeatable. |
| `--name` | `-n` | string | Output basename for this pack. |
| `--format` | `-F` | `md`/`txt` | Output format. Markdown is the default. |
| `--depth` |  | number | Maximum dependency traversal depth. |
| `--max-files` |  | number | Maximum traced file count. |
| `--dry-run` |  | boolean | Perform a dry-run without writing output files. |

### `trace` Command

Trace imports from an entrypoint.

| Flag | Short | Type | Description |
| --- | --- | --- | --- |
| `--target` | `-t` | list | Target file/module to resolve and trace from. Repeatable and comma-aware. |
| `--exclude` | `-x` | list | File or glob to skip during traversal. Repeatable and comma-aware. |
| `--name` | `-n` | string | Output basename for this trace. |
| `--format` | `-F` | `md`/`txt` | Output format. Markdown is the default. |
| `--depth` |  | number | Maximum dependency traversal depth. |
| `--max-files` |  | number | Maximum traced file count. |
| `--dry-run` |  | boolean | Perform a dry-run without writing output files. |

### `scope` Command

Run configured scopes separately.

| Flag | Short | Type | Description |
| --- | --- | --- | --- |
| `--key` | `-k` | list | Scope key to execute. Repeatable and comma-aware. |
| `--all` | `-a` | boolean | Run every configured scope. |
| `--list` |  | boolean | List configured scope keys. |
| `--format` | `-F` | `md`/`txt` | Output format. Markdown is the default. |
| `--dry-run` |  | boolean | Perform a dry-run without writing output files. |

### `git` and `grep` Commands

Run git-based or text-search extractions. Use command-specific help for details on all available options:
* `prodex git [root] --help`
* `prodex grep [root] --help`

### Global Help and Version

```bash
prodex --version
prodex pack --help
prodex trace --help
prodex scope --help
prodex migrate --help
```

## Configuration

Prodex reads `prodex.json` from the project root.

```json
{
  "version": 5,
  "$schema": "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
  "output": {
    "dir": "prodex",
    "format": "md",
    "versioned": true
  },
  "exclude": ["node_modules/**", "vendor/**", "dist/**"],
  "aliases": {
    "@": "resources/js"
  },
  "depth": 10,
  "maxFiles": 200,
  "scopes": {}
}
```

Naming precedence:

1. `--name`
2. `scope.name`
3. Scope key, when running a configured scope
4. Automatic name from entries
5. Internal fallback: `combined`

CLI flags override config values for a run. Excludes are additive (root excludes + scope excludes + CLI excludes).

## Migrating Configs

Prodex requires config version 5. If a project has an older `prodex.json`, Prodex CLI will fail and prompt to migrate.

Preview a migration:

```bash
prodex migrate
```

Check whether migration is needed:

```bash
prodex migrate --check
```

Write the migration:

```bash
prodex migrate --write
```

`--write` creates a backup before replacing `prodex.json`.

## Requirements

- Node.js 22+
- A project with JS, TS, TSX, declaration-file, or PHP entrypoints for dependency tracing
- Any file type can be added through include-only extraction
- Optional `prodex.json` for saved defaults and scopes

## License

MIT
