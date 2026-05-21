# Changelog

## [2.0.0](https://github.com/emxhive/prodex/compare/v1.4.11...v2.0.0) (2026-05-21)

Prodex 2.0.0 is a major CLI, configuration, output, and packaging release.

This release replaces the older shortcut-based workflow with explicit commands and named profiles, introduces config version 4, adds migration tooling, improves generated Markdown traces, and moves publishing to the GitHub release pipeline.

### ⚠ Breaking Changes

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

* **Profile and output naming behavior changed.**

  * Output names now resolve in this order:

    * `--name`
    * `profile.name`
    * profile key
    * smart name derived from entry files
    * `prodex` when no entry-derived name is available

* **Legacy CLI flags changed.**

  * `--files` / `-f` is now `--entry` / `-e`
  * `--txt` / `-t` is now `--format txt`
  * `--limit` / `-l` is now `--max-files`
  * `--shortcut` / `@name` is now `--profile`
  * `@` is now `--all-profiles`

* **Command result terminology changed.**

  * Result fields now use profile terminology instead of shortcut terminology.

### Migration

Existing projects should migrate their config before using 2.0.0:

```bash
prodex migrate
prodex migrate --check
prodex migrate --write
```

`prodex migrate --write` creates a backup before replacing `prodex.json`.

### Added

* Added the `profiles` workflow for reusable named context maps.
* Added `prodex profiles` to list configured profiles.
* Added `prodex migrate`, `prodex migrate --check`, and `prodex migrate --write`.
* Added config migration support for legacy `prodex.json` files.
* Added profile-key output naming when no explicit `--name` or `profile.name` is provided.
* Added smart output naming from entry file names.
* Added generated Markdown trace metadata:

  * index range marker
  * file count marker
  * per-file section line ranges
* Added package type declarations through `types`.
* Added package `exports`.
* Added schema export at `prodex/schema`.
* Added CI and release workflows.
* Added GitHub-managed Release Please and npm publishing flow.

### Changed

* Reworked CLI parsing around explicit commands and structured flags.
* Reworked config normalization around the version 4 schema.
* Reworked run planning around profiles instead of shortcuts.
* Reworked output generation into dedicated Markdown and text renderers.
* Improved JS/TS and PHP resolver organization.
* Improved alias resolution and tracing internals.
* Improved README documentation for commands, profiles, configuration, and migration.
* Improved tests around CLI behavior, migration, profile runs, output naming, and tracing modes.

### Removed

* Removed legacy shortcut configuration.
* Removed legacy shortcut command behavior.
* Removed `output.prefix` from the v4 config shape.
* Removed legacy config fields from the active schema.
* Removed Node.js 18 support.

### Publishing

* Releases are now managed through Release Please.
* npm publishing now runs through GitHub Actions.
* The publish job verifies that the release tag matches `package.json`.
* The publish job runs tests and `npm pack --dry-run` before publishing.
