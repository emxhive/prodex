# Prodex

Prodex packages the code an AI tool, reviewer, or teammate needs to see into readable Markdown or TXT.

Use it to snapshot Git changes, collect files by search, save repeatable scopes, attach command output, or gather explicit files — without copy-pasting half your repo into a chat window.

## Installation

```bash
npm install -g prodex
```

Or run it ad hoc without installing:

```bash
npx prodex git --against origin/main
```

Create a starter config:

```bash
prodex init
```

## Quick Start

```bash
# Package all files changed in your current branch vs. origin/main
prodex git --against origin/main

# Include the diff beside the changed files
prodex git --changed --include-diff

# Collect every file that references a term or symbol
prodex grep --query "StripeWebhookHandler"

# Run a saved context selection
prodex scope -k billing

# Attach test output beside the code
prodex scope -k auth --cmd "npm test -- auth"

# Collect explicit files without dependency tracing
prodex pack -i src/config/database.ts,src/models/User.ts,docs/schema.md

# Trace imports from an entry file (JS, TS, PHP)
prodex trace -t src/api/router.ts
```

By default, commands write a versioned Markdown file to `./prodex/`. You can switch to TXT with `--format txt`. Output filenames include a `-trace` suffix and a timestamp when versioning is enabled (e.g. `billing-trace_260620-0430.md`). The output includes a file index, line ranges, and the collected source content in a single readable document.

## Common Workflows

### Review your current branch against origin/main

```bash
prodex git --against origin/main
```

Snapshots every file changed between your current HEAD and the merge-base with `origin/main`. Good for pre-PR review or sending a branch summary to an AI assistant.

### Include the diff beside changed files

```bash
prodex git --changed --include-diff
```

Includes the raw Git diff in the output alongside the collected files. In working-tree mode, two diff sections are added: one for unstaged changes and one for staged changes.

### Collect files by search

```bash
prodex grep --query "legacyPaymentClient"
prodex grep --any "AuthService,SessionManager"
prodex grep --regex "use.*Repository"
```

Finds files containing the term or pattern and packages them into one document. Use this when the files you need are spread across the codebase and defined by what they reference, not where they live.

### Run a saved scope

```bash
prodex scope -k billing
prodex scope -k auth,billing
prodex scope --all
```

Runs a named context selection you configured in `prodex.json`. Scopes are the repeatable version of an ad hoc command — same files, every time, no manual reassembly.

### Attach command output beside the code

```bash
prodex scope -k auth --cmd "npm test -- auth"
prodex git --against origin/main --cmd "npm run lint"
```

Runs the command after collecting files and embeds its output in the document. The AI sees the failing test or lint result right next to the source that produced it.

### Collect explicit files

```bash
prodex pack -i src/config/database.ts,src/models/User.ts,docs/schema.md
prodex pack -i "app/Http/Controllers/**"
```

Adds files directly by path or glob without dependency tracing. Use this when you know exactly which files you want and do not need imports followed automatically.

### Trace imports from an entry file

```bash
prodex trace -t src/api/router.ts
prodex pack -e app/Http/Controllers/CheckoutController.php
```

Follows import and require statements from the entry file to collect the files it depends on. Supported for JavaScript, TypeScript, TSX, declaration files, and PHP. See [Dependency Tracing](#dependency-tracing) for current language support details.

`prodex trace` resolves targets by exact path, extensionless name, or bare module name — it does not accept glob patterns. Use `prodex pack --entry <glob>` to collect files by glob.

## How Prodex Collects Context

Prodex can collect context from Git changes, search results, saved scopes, explicit files, or traced entrypoints. Command output can be attached to any run.

### Git

`prodex git` reads your repository's Git history or working tree and snapshots the files involved.

Working-tree modes read file contents from disk:
- `--changed` (default): staged, unstaged, and untracked files
- `--staged`: staged files only
- `--unstaged`: unstaged files only
- `--untracked`: untracked files only

Historical modes snapshot file contents from Git at the specified revision:
- `--commit <rev>`: files changed by one commit
- `--range <base..head>` or `<base...head>`: files changed between two refs
- `--against <base>`: files changed between the merge-base of `<base>` and HEAD — the standard PR-style comparison

Add `--include-diff` to any git run to include the raw diff output alongside the file contents. In working-tree mode this adds two sections — one for unstaged changes (`Full Diff`) and one for staged changes (`Cached Full Diff`).

### Search

`prodex grep` searches your project for files containing a term or pattern and packages the matching files.

Search modes:
- `--query <text>`: files containing a fixed string
- `--any <list>`: files containing any of the terms (OR)
- `--all <list>`: files containing all of the terms (AND)
- `--regex <pattern>`: files matching a regular expression

Narrow the search with `--within <path>` or exclude paths with `--skip <path>`. Filter out files whose contents contain a term using `--not <text>`.

### Scopes

Saved named selections in `prodex.json`. See [Saved Scopes](#saved-scopes).

### Pack

`prodex pack` accepts `--include` for direct file collection, `--entry` to trace imports from an entry file, or both together. It is the same tracing engine as `prodex trace` with the option to mix in explicit files in the same run.

### Command Output

`--cmd` runs a shell command after files are collected and embeds the output in the document. See [Command Attachments](#command-attachments).

## Saved Scopes

Scopes are named, reusable context selections you configure once in `prodex.json` and run any time.

A scope can collect files in two ways:

- **By path**: select files and folders you know by name.
- **By search**: select files by what they contain.

```bash
prodex scope -k dashboard        # run one scope
prodex scope -k auth,billing     # run multiple
prodex scope --all               # run all configured scopes
prodex scope --list              # show available scope keys
```

### File scope example

Selects files by path, with optional dependency tracing from `entry` files:

```json
{
  "version": 5,
  "scopes": {
    "dashboard": {
      "entry": ["resources/js/pages/Dashboard.tsx"],
      "include": ["routes/web.php"],
      "exclude": ["resources/js/components/ui"]
    }
  }
}
```

`entry` traces imports. `include` adds files directly. Both are optional — a scope can use either or both.

### Search scope example

Selects files by what they contain:

```json
{
  "version": 5,
  "scopes": {
    "payments": {
      "grep": {
        "query": "StripeWebhookHandler",
        "within": ["app", "tests"],
        "skip": ["vendor"]
      }
    }
  }
}
```

Search scope options under `grep`:
- `query`: fixed-string match
- `any`: list — files containing any term
- `all`: list — files containing all terms
- `regex`: regular expression
- `not`: filter out files whose contents contain these terms
- `within`: search only these paths
- `skip`: skip these paths

A scope can collect by path using `entry` and/or `include`, or by search using `grep`. A search scope may also use `include` for extra files, but it cannot define `entry`.

### Scope keys and names

The scope key is the identifier used in CLI selection. The optional `name` field sets the output filename:

```json
"scopes": {
  "dashboard": {
    "name": "frontend-dashboard",
    "entry": ["resources/js/pages/Dashboard.tsx"]
  }
}
```

```bash
prodex scope -k dashboard   # output filename: frontend-dashboard
```

If `name` is omitted, the scope key is used as the output filename.

## Command Attachments

Add `--cmd` to any run to capture shell command output and embed it in the document alongside the collected files.

```bash
prodex scope -k auth --cmd "npm test -- auth"
prodex git --against origin/main --cmd "npm run lint"
prodex pack -e src/index.ts --cmd "npm run build"
```

`--cmd` is repeatable. Commands run sequentially after files are collected, and each output is included as a separate section.

By default, a failed command adds a warning but still produces the output file. Use `--fail-on-cmd-error` to exit with an error instead.

Use `--dry-run` to preview which commands would run without executing them.

## Dependency Tracing

`prodex pack --entry` and `prodex trace` follow import statements from an entry file to collect the files it depends on.

**Currently supported:**

- JavaScript and TypeScript: ES module imports, dynamic imports, CommonJS `require`, re-exports
- TSX and declaration files (`.d.ts`)
- PHP: static `include`/`require` statements, namespace imports, PSR-4 resolution, some Laravel service binding awareness

**Limitations:**

- Dynamic imports that are computed at runtime may not be followed
- Framework-injected dependencies (e.g., auto-resolved services, IoC containers) may not be resolved automatically
- Languages other than JS, TS, TSX, and PHP are not traced — use `--include` or a file scope to add those files directly

When tracing does not follow a relationship, add the file manually with `--include` or in the scope's `include` list. Prodex does not attempt to guess at runtime behaviour.

## Configuration

Prodex reads `prodex.json` from the project root. All fields are optional — Prodex works without a config file.

```json
{
  "version": 5,
  "$schema": "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
  "output": {
    "dir": "prodex",
    "format": "md",
    "versioned": true
  },
  "exclude": ["node_modules", "vendor", "dist"],
  "aliases": {
    "@": "resources/js"
  },
  "depth": 2,
  "scopes": {}
}
```

`exclude`, `include`, and similar path fields accept file paths, folder names, or glob patterns.

**Naming precedence** (highest to lowest):

1. `--name` flag
2. `scope.name` in config
3. Scope key, when running a configured scope
4. Automatic name derived from entries
5. Internal fallback: `combined`

CLI flags override config values for a run. Excludes are additive: root excludes, scope excludes, and CLI excludes are all applied together.

## CLI Reference

### `git` — Snapshot Git changes

```bash
prodex git [root] --against <base>
prodex git [root] --changed
prodex git [root] --staged
prodex git [root] --unstaged
prodex git [root] --untracked
prodex git [root] --commit <rev>
prodex git [root] --range <base..head>
prodex git [root] --range <base...head>
```

| Flag | Type | Description |
|---|---|---|
| `--changed` | boolean | Staged, unstaged, and untracked files (default) |
| `--staged` | boolean | Staged files only |
| `--unstaged` | boolean | Unstaged files only |
| `--untracked` | boolean | Untracked files only |
| `--commit <rev>` | string | Files changed by one commit; contents from that commit |
| `--range <spec>` | string | Files changed between two refs; contents from head |
| `--against <base>` | string | Files changed between merge-base and HEAD |
| `--include-diff` | boolean | Include full diff output in the document |
| `--include` / `-i` | list | Extra files to add |
| `--exclude` / `-x` | list | Files or paths to skip |
| `--name` / `-n` | string | Output filename |
| `--format` / `-F` | `md`/`txt` | Output format |
| `--cmd` | list | Command to run and embed. Repeatable. |
| `--fail-on-cmd-error` | boolean | Exit nonzero if an attached command fails |
| `--dry-run` | boolean | Preview without writing output |

### `grep` — Collect files by search

```bash
prodex grep [root] --query <text>
prodex grep [root] --any <term,term,...>
prodex grep [root] --all <term,term,...>
prodex grep [root] --regex <pattern>
```

| Flag | Short | Type | Description |
|---|---|---|---|
| `--query` | `-q` | string | Fixed-string search |
| `--any` | | list | Files containing any of the terms (OR) |
| `--all` | | list | Files containing all of the terms (AND) |
| `--regex` | `-r` | string | Regular expression search |
| `--not` | | list | Filter out files whose contents contain these terms |
| `--within` | | list | Search only inside these paths |
| `--skip` | | list | Skip these paths during search |
| `--include` | `-i` | list | Add extra files |
| `--exclude` | `-x` | list | Skip these files |
| `--name` | `-n` | string | Output filename |
| `--format` | `-F` | `md`/`txt` | Output format |
| `--cmd` | | list | Command to run and embed. Repeatable. |
| `--fail-on-cmd-error` | | boolean | Exit nonzero if an attached command fails |
| `--dry-run` | | boolean | Preview without writing output |

### `scope` — Run saved scopes

```bash
prodex scope [root] -k <key>
prodex scope [root] -k <key,key,...>
prodex scope [root] --all
prodex scope [root] --list
```

| Flag | Short | Type | Description |
|---|---|---|---|
| `--key` | `-k` | list | Scope key to run. Comma-aware and repeatable. |
| `--all` | `-a` | boolean | Run all configured scopes |
| `--list` | | boolean | List configured scope keys |
| `--exclude` | `-x` | list | Additional paths to skip |
| `--format` | `-F` | `md`/`txt` | Output format |
| `--cmd` | | list | Command to run and embed. Repeatable. |
| `--fail-on-cmd-error` | | boolean | Exit nonzero if an attached command fails |
| `--dry-run` | | boolean | Preview without writing output |

### `pack` — Collect explicit files or combine sources

```bash
prodex pack [root] -i <glob>
prodex pack [root] -e <entry> -i <glob>
```

| Flag | Short | Type | Description |
|---|---|---|---|
| `--entry` | `-e` | list | Entry file to trace imports from. Repeatable and comma-aware. |
| `--include` | `-i` | list | File or glob to add without tracing. Repeatable and comma-aware. |
| `--exclude` | `-x` | list | File or path to skip. |
| `--scope` | `-s` | list | Merge a configured scope's files into this pack. |
| `--name` | `-n` | string | Output filename |
| `--format` | `-F` | `md`/`txt` | Output format |
| `--depth` | | number | Maximum tracing depth |
| `--cmd` | | list | Command to run and embed. Repeatable. |
| `--fail-on-cmd-error` | | boolean | Exit nonzero if an attached command fails |
| `--dry-run` | | boolean | Preview without writing output |

### `trace` — Trace imports from an entry file

```bash
prodex trace [root] -t <file>
```

| Flag | Short | Type | Description |
|---|---|---|---|
| `--target` | `-t` | list | File or module name to trace from. Accepts exact paths, extensionless names, or bare module names — not globs. Repeatable and comma-aware. |
| `--include` | `-i` | list | Extra files to add |
| `--exclude` | `-x` | list | Files or paths to skip |
| `--name` | `-n` | string | Output filename |
| `--format` | `-F` | `md`/`txt` | Output format |
| `--depth` | | number | Maximum tracing depth |
| `--cmd` | | list | Command to run and embed. Repeatable. |
| `--fail-on-cmd-error` | | boolean | Exit nonzero if an attached command fails |
| `--dry-run` | | boolean | Preview without writing output |

### Global flags

```bash
prodex --version
prodex --help
prodex <command> --help
```

## Migrating Configs

Prodex requires config version 5. If your project has an older `prodex.json`, Prodex will fail with a prompt to migrate.

```bash
prodex migrate           # preview the migration
prodex migrate --check   # exit nonzero if migration is needed
prodex migrate --write   # apply the migration (creates a backup first)
```

## Requirements

- Node.js 22+
- `prodex.json` is optional; Prodex works without one
- Dependency tracing requires JS, TS, TSX, or PHP entrypoints
- Any file type can be collected with `--include` or a file scope
- `prodex grep` and search scopes require [ripgrep](https://github.com/BurntSushi/ripgrep) (`rg`) to be installed and available on your PATH

## License

MIT
