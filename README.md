# Prodex v1.4.11

Unified project indexer and dependency extractor for JavaScript, TypeScript, React, and Laravel stacks.

Prodex runs from the command line. Point it at one or more entry files, optionally add includes/excludes, and it traces dependencies into a versioned Markdown or text export.

## Requirements

- Node.js 18+
- A project with resolvable JS/TS/PHP entry files
- Optional `prodex.json` for saved defaults and shortcuts

## Installation

```bash
npm install -g prodex
```

Or run ad hoc:

```bash
npx prodex
```

Generate a starter config:

```bash
prodex init
```

## CLI Usage

```bash
prodex [root] --files "src/index.ts" --include "**/*.d.ts" --exclude "node_modules/**"
prodex run [root] --files "routes/web.php,resources/js/app.tsx"
prodex shortcuts [root]
```

| Flag | Short | Type | Description |
| --- | --- | --- | --- |
| `--files` | `-f` | list | Entry files to trace, comma-separated. |
| `--include` | `-i` | list | Extra files/patterns appended without dependency resolution. |
| `--exclude` | `-x` | list | Patterns or folders to skip during traversal. |
| `--name` | `-n` | string | Custom output prefix. |
| `--txt` | `-t` | boolean | Output plain text instead of Markdown. |
| `--limit` | `-l` | number | Override traversal limit. |
| `--ci` | `-c` | boolean | Avoid terminal-interactive behavior. |
| `--debug` | `-d` | boolean | Emit debug logs during traversal. |
| `--shortcut` | `-a` | string | Apply a named shortcut from `prodex.json`. |
| `--shortcuts` |  | boolean | List configured shortcut keys and exit. |
| `--help` | `-h` | boolean | Show CLI help and exit. |
| `--version` | `-v` | boolean | Show version and exit. |

## Shortcuts

Define reusable sets in `prodex.json` under `shortcuts`.

```bash
prodex -a dashboard
prodex @dashboard
prodex @dashboard @api
prodex @
```

Shortcut order is preserved when multiple shortcuts are provided.

List available shortcut keys without running:

```bash
prodex shortcuts
prodex --shortcuts
prodex shortcuts ./some-project
```

## Configuration

```json
{
  "version": 3.1,
  "$schema": "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
  "output": { "dir": "prodex", "versioned": true, "prefix": "combined", "format": "md" },
  "entry": { "files": ["src/index.ts"] },
  "resolve": {
    "include": [],
    "aliases": { "@": "resources/js" },
    "exclude": ["node_modules/**", "@shadcn/**", "**/components/ui/**"],
    "depth": 10,
    "limit": 200
  },
  "shortcuts": {
    "dashboard": {
      "prefix": "dashboard",
      "files": ["resources/js/**/dashboard.tsx"],
      "include": ["**/*.d.ts"],
      "exclude": ["node_modules/**"]
    }
  }
}
```

CLI flags override config values for a run.

## Output

- Default output directory: `./prodex/`
- Default prefix: `combined`
- Markdown is the default format
- Use `--txt` for plain text output
- Versioned filenames prevent accidental overwrites

## Roadmap

- Smarter alias resolution and PSR-4 scanning for PHP projects
- Performance optimizations for very large dependency graphs
- Smart splitting for oversized combined outputs

## License

MIT
