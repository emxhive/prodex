# Prodex v1.4.11

Unified project indexer and dependency extractor for JavaScript, TypeScript, React, and Laravel stacks.

Prodex runs from explicit commands. Point `prodex run` at one or more entries, optionally add includes/excludes, and it traces dependencies into a versioned Markdown or text export.

## Requirements

- Node.js 18+
- A project with resolvable JS/TS/PHP entry files
- Optional `prodex.json` for saved defaults and profiles

## Installation

```bash
npm install -g prodex
```

Or run ad hoc:

```bash
npx prodex run --entry src/index.ts
```

Generate a starter config:

```bash
prodex init
```

## CLI Usage

```bash
prodex run [root] --entry src/index.ts
prodex run [root] --entry routes/web.php --include "**/*.d.ts"
prodex run [root] --profile dashboard
prodex run [root] --all-profiles
prodex profiles [root]
prodex migrate [root]
```

`prodex run` requires the `run` verb. Positional root-only sugar is intentionally not supported.

### Run Options

| Flag | Short | Type | Description |
| --- | --- | --- | --- |
| `--entry` | `-e` | list | Entry file/glob to trace. Repeatable and comma-aware. |
| `--include` | `-i` | list | Extra file/glob appended without dependency resolution. Repeatable and comma-aware. |
| `--exclude` | `-x` | list | File/glob to skip during traversal. Repeatable and comma-aware. |
| `--profile` | `-p` | list | Named profile to run. Repeatable. |
| `--all-profiles` |  | boolean | Run every configured profile. |
| `--name` | `-n` | string | Output basename for this run. |
| `--format` | `-F` | `md`/`txt` | Output format. |
| `--max-depth` |  | number | Maximum dependency traversal depth. |
| `--max-files` |  | number | Maximum traced file count. |
| `--debug` | `-d` | boolean | Emit debug logs during traversal. |

Global metadata flags:

```bash
prodex --version
prodex run --help
prodex profiles --help
prodex migrate --help
```

## Profiles

Profiles are named run configurations stored in `prodex.json`.

```bash
prodex profiles
prodex run --profile dashboard
prodex run --profile dashboard --profile api
prodex run --all-profiles
```

Profile order is preserved when multiple profiles are provided.

## Configuration

```json
{
  "version": 4,
  "$schema": "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
  "output": {
    "dir": "prodex",
    "format": "md",
    "versioned": true
  },
  "entry": ["src/index.ts"],
  "include": [],
  "exclude": ["node_modules/**", "vendor/**", "dist/**"],
  "resolve": {
    "aliases": { "@": "resources/js" },
    "maxDepth": 10,
    "maxFiles": 200
  },
  "profiles": {
    "dashboard": {
      "name": "dashboard",
      "entry": ["resources/js/**/dashboard.tsx"],
      "include": ["**/*.d.ts"],
      "exclude": ["node_modules/**"]
    }
  }
}
```

Naming precedence:

1. `--name`
2. `profile.name`
3. automatic name from entries
4. internal fallback: `combined`

CLI flags override config values for a run. Profile arrays replace base arrays for that profile run.

## Migrating To Config v4

Prodex requires config version 4. If a project has an older `prodex.json`, `prodex run` and `prodex profiles` fail with migration instructions instead of guessing.

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

## Output

- Default output directory: `./prodex/`
- Markdown is the default format
- Use `--format txt` for plain text output
- Versioned filenames prevent accidental overwrites

## License

MIT
