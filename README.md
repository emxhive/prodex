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
prodex run --entry src/index.ts
```

Prodex resolves the requested entrypoints from your project root, follows supported dependency references, applies include and exclude rules, then writes a versioned Markdown file to `./prodex/` by default.

For example:

```bash
prodex run --entry resources/js/pages/Dashboard.tsx --include "routes/**/*.php"
```

This traces the dashboard entrypoint and adds the matching route files to the exported context.

## Profiles

Profiles are reusable named context maps stored in `prodex.json`.

They are one of Prodex's most useful workflow features: instead of rebuilding the same trace commands every time, teams can save important project areas as named profiles such as `dashboard`, `auth`, `billing`, `api`, `admin`, or `checkout`.

```bash
prodex run --profile dashboard
prodex run --profile auth,billing
prodex run --all-profiles
prodex profiles
```

Use profiles when a project has recurring review surfaces or ownership areas. A profile can define its own entries, includes, excludes, and optional output name; when no output name is set, the profile key becomes the trace basename. This makes context extraction repeatable across debugging, reviews, documentation, handoffs, and release work. Run one profile, a comma-separated set of profiles, or all profiles when you need a broader pass.

Example:

```json
{
    "version": 4,
    "$schema": "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
    "output": {
        "dir": "prodex",
        "format": "md",
        "versioned": true
    },
    "entry": [],
    "include": [],
    "exclude": ["node_modules/**", "vendor/**", "dist/**"],
    "resolve": {
        "aliases": {
            "@": "resources/js"
        },
        "maxDepth": 10,
        "maxFiles": 200
    },
    "profiles": {
        "dashboard": {
            "entry": ["resources/js/pages/Dashboard.tsx"],
            "include": ["routes/**/*.php", "resources/js/types/**/*.d.ts"],
            "exclude": ["resources/js/components/ui/**"]
        },
        "api": {
            "entry": ["routes/api.php"],
            "include": ["app/Http/Requests/**/*.php"],
            "exclude": ["vendor/**"]
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

Today it works best with projects that use JavaScript, TypeScript, PHP, React, and Laravel-aware structures. Current tracing support includes JS/TS imports, dynamic imports, CommonJS `require`, re-exports, static PHP include/require statements, PHP namespace imports, PSR-4 resolution, and some Laravel binding awareness.

Unsupported or dynamic relationships may need to be added with `--include` or profile `include` rules. That is expected: Prodex favors a focused, readable trace over pretending to understand every runtime edge in a project.

## Installation

```bash
npm install -g prodex
```

Or run it ad hoc:

```bash
npx prodex run --entry src/index.ts
```

Create a starter config:

```bash
prodex init
```

## Common Commands

```bash
prodex run [root] --entry src/index.ts
prodex run [root] --entry routes/web.php --include "**/*.d.ts"
prodex run [root] --profile dashboard
prodex run [root] --profile dashboard,api
prodex run [root] --all-profiles
prodex profiles [root]
prodex migrate [root]
```

`prodex run` requires the `run` command. Root-only positional command shortcuts are intentionally not supported.

## CLI Reference

| Flag | Short | Type | Description |
| --- | --- | --- | --- |
| `--entry` | `-e` | list | Entry file or glob to trace. Repeatable and comma-aware. |
| `--include` | `-i` | list | Extra file or glob to add without dependency tracing. Repeatable and comma-aware. |
| `--exclude` | `-x` | list | File or glob to skip during traversal. Repeatable and comma-aware. |
| `--profile` | `-p` | list | Named profile to run. Comma-aware and repeatable. |
| `--all-profiles` |  | boolean | Run every configured profile. |
| `--name` | `-n` | string | Output basename for this run. |
| `--format` | `-F` | `md`/`txt` | Output format. Markdown is the default. |
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

## Configuration

Prodex reads `prodex.json` from the project root.

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
        "aliases": {
            "@": "resources/js"
        },
        "maxDepth": 10,
        "maxFiles": 200
    },
    "profiles": {}
}
```

Naming precedence:

1. `--name`
2. `profile.name`
3. Profile key, when running a named profile
4. Automatic name from entries
5. Internal fallback: `combined`

CLI flags override config values for a run. Profile arrays replace base arrays for that profile run.

## Migrating Configs

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

## Requirements

- Node.js 18+
- A project with resolvable JS, TS, or PHP entry files
- Optional `prodex.json` for saved defaults and profiles

## License

MIT
