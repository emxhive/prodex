# Changelog

## [2.0.0](https://github.com/emxhive/prodex/compare/v1.4.11...v2.0.0) (2026-05-21)

Prodex 2.0.0 is a major CLI, configuration, output, and packaging release.

This release replaces the older shortcut-based workflow with explicit commands and named profiles, introduces config version 4, adds migration tooling, improves generated Markdown traces, and moves publishing to the GitHub release pipeline.

### ⚠ Breaking Changes

#### User-facing

* **Node.js 22 or newer is now required.**

  * Previous versions supported Node.js 18+.
  * Update local and CI environments before upgrading.

* **CLI commands are now explicit.**

  * Use `prodex run` instead of relying on root-only/default run behavior.
  * Supported commands now include:

    * `prodex run`
    * `prodex init`
    * `prodex profiles`
    * `prodex migrate`

* **Shortcuts have been replaced by profiles.**

  * `shortcuts` is now `profiles`.
  * `prodex shortcuts` is now `prodex profiles`.
  * Shortcut-style CLI usage has been replaced with profile flags.

* **Config version 4 replaces the old config shape.**

  * `entry.files` is now `entry`
  * `resolve.include` is now `include`
  * `resolve.exclude` is now `exclude`
  * `resolve.depth` is now `resolve.maxDepth`
  * `resolve.limit` is now `resolve.maxFiles`
  * `output.prefix` has been removed

* **Legacy CLI flags changed.**

  * `--files` / `-f` is now `--entry` / `-e`
  * `--txt` / `-t` is now `--format txt`
  * `--limit` / `-l` is now `--max-files`
  * `--shortcut` / `@name` is now `--profile`
  * `@` is now `--all-profiles`

* **Output naming behavior changed.**

  * Output names now resolve in this order:

    * `--name`
    * `profile.name`
    * profile key
    * smart name derived from entry files
    * `prodex` when no entry-derived name is available

#### API/package surface

* **Command result terminology changed.**

  * Result fields now use profile terminology instead of shortcut terminology.
  * `shortcuts` became `profiles`.
  * `shortcut` became `profile`.

* **The published package surface changed.**

  * Type declarations are now published through `types`.
  * Package `exports` are now defined.
  * The JSON schema is now exported as `prodex/schema`.

### Migration

Existing projects should migrate their config before using 2.0.0:

```bash
prodex migrate
prodex migrate --check
prodex migrate --write
```

`prodex migrate --write` creates a backup before replacing `prodex.json`.

Manual migration summary:

* Rename `shortcuts` to `profiles`.
* Replace `entry.files` with `entry`.
* Move `resolve.include` to top-level `include`.
* Move `resolve.exclude` to top-level `exclude`.
* Rename `resolve.depth` to `resolve.maxDepth`.
* Rename `resolve.limit` to `resolve.maxFiles`.
* Replace `output.prefix` with `--name`, `profile.name`, or the profile key.

### User-facing Additions

* Added named profiles for reusable context maps.
* Added `prodex profiles` to list configured profiles.
* Added config migration commands:

  * `prodex migrate`
  * `prodex migrate --check`
  * `prodex migrate --write`
* Added profile-key output naming when no explicit `--name` or `profile.name` is provided.
* Added smart output naming from entry file names.
* Added generated Markdown trace metadata:

  * index range marker
  * file count marker
  * per-file section line ranges

### User-facing Changes

* Reworked CLI usage around explicit commands.
* Reworked CLI flags around clearer names:

  * `entry`
  * `include`
  * `exclude`
  * `profile`
  * `format`
  * `maxDepth`
  * `maxFiles`
* Reworked config files around version 4.
* Reworked saved workflows around profiles instead of shortcuts.
* Improved README documentation for commands, profiles, configuration, output naming, and migration.

### Internal / Codebase Changes

* Reorganized CLI handling into command modules.
* Reworked config loading, normalization, defaults, and migration into dedicated modules.
* Reworked run planning around profile-aware execution.
* Split output generation into dedicated Markdown and text renderers.
* Added Markdown trace analysis for index ranges and section line ranges.
* Reorganized filesystem, cache, tracing, resolver, diagnostics, and output modules.
* Improved JS/TS and PHP resolver internals.
* Improved alias resolution and tracing internals.
* Added architecture checks.
* Expanded CLI contract tests for commands, migration, profiles, output naming, tracing modes, and error behavior.

### Packaging and Release Infrastructure

* Added package type declarations.
* Added package `exports`.
* Added schema export at `prodex/schema`.
* Added schema file to the published npm package.
* Added CI workflow for Node.js 22 and 24.
* Added Release Please configuration.
* Added GitHub Actions release workflow.
* Added npm publish verification:

  * install dependencies
  * verify release tag matches `package.json`
  * run tests
  * run `npm pack --dry-run`
  * publish to npm

### Removed

#### User-facing

* Removed legacy shortcut configuration.
* Removed legacy shortcut command behavior.
* Removed `output.prefix` from the v4 config shape.
* Removed legacy config fields from the active schema.
* Removed Node.js 18 support.

#### Internal

* Removed older shortcut-oriented run planning code.
* Removed older renderer layout in favor of dedicated output modules.
* Removed committed editor/project-local configuration files.
