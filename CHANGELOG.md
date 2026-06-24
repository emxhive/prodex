# Changelog

## [2.1.0](https://github.com/emxhive/prodex/compare/v2.0.1...v2.1.0) (2026-06-24)

> **⚠ Migration required:** This release includes breaking CLI and config changes. After installing v2.1.0, run `prodex migrate --write` before normal use to update `prodex.json` to config version 5, and update any scripts using `prodex run`, `prodex profiles`, `--profile`, `--all-profiles`, `--max-depth`, or `prodex trace --entry`.

### Added

#### `prodex git` — Git-aware artifact collection

Collect and package files from your working tree or Git history into a single artifact.

**Working-tree mode** (default when no history flag is given):

```bash
prodex git                          # staged + unstaged + untracked (default)
prodex git --staged                 # staged only
prodex git --unstaged               # unstaged only
prodex git --untracked              # untracked only
prodex git --changed                # all three explicitly
```

**Historical modes** — snapshot files as they existed at a point in history:

```bash
prodex git --commit <rev>           # files touched by a single commit
prodex git --range main..feature    # files changed between two commits
prodex git --against main           # files changed on HEAD since branching from main
```

Git runs embed relevant metadata such as status, diff-stat, and file notes in the artifact. Pass `--include-diff` to also embed the full patch. Use `--include` and `--exclude` to add extra files or filter results.

---

#### `prodex grep` — Content-search artifact collection

Find files by content using [ripgrep](https://github.com/BurntSushi/ripgrep) and package them into an artifact. **Requires `rg` to be installed and available in `PATH`.**

```bash
prodex grep --query "useEffect"             # fixed-string match
prodex grep --any "useState,useRef"         # OR match
prodex grep --all "useEffect,fetch"         # AND match (both terms must appear)
prodex grep --regex "use[A-Z]\w+"           # regex match
```

Narrow or exclude results:

```bash
prodex grep --query "TODO" --within src/    # search only inside src/
prodex grep --query "TODO" --skip tests/    # skip tests/
prodex grep --query "TODO" --not generated  # exclude files containing "generated"
```

`--include`, `--exclude`, and `--max-files` work alongside grep selection.

**Grep-backed scopes:** a scope in `prodex.json` can include a `grep` block to make `prodex scope -k <key>` run a content-search collection instead of an entry-based one:

```json
"scopes": {
  "todos": {
    "grep": { "query": "TODO" }
  }
}
```

Grep-backed scopes require `rg` in `PATH`, the same as `prodex grep`.

---

#### Command attachments — `--cmd`, `--cmd-timeout`, `--fail-on-cmd-error`

Run shell commands after an artifact is collected and embed their output alongside the code context. Available on `pack`, `trace`, `scope`, `git`, and `grep`.

```bash
prodex git --changed --cmd "npm test" --cmd "npm run lint"
```

- `--cmd` is repeatable; commands execute **sequentially** in the order given.
- Output (stdout + stderr) is embedded as a **Command Outputs** section in the artifact.
- Source files are snapshotted **before** attached commands run, so command side effects do not alter the captured content.
- `--cmd-timeout <seconds>` sets a per-command timeout (default: `180`).
- `--fail-on-cmd-error` causes the run to exit non-zero if any command fails (default: warning only).
- In dry-run mode, planned commands are listed but not executed.

---

### Changed

#### CLI commands restructured

`prodex run` and `prodex profiles` are no longer supported as active commands. The CLI now has explicit, purpose-scoped commands:

| Before (v2.0.1) | After (v2.1.0) |
|---|---|
| `prodex run --entry <glob>` | `prodex pack --entry <glob>` |
| `prodex run --entry <file>` (for tracing) | `prodex trace --target <file>` |
| `prodex run --profile <key>` | `prodex scope -k <key>` |
| `prodex run --all-profiles` | `prodex scope --all` |
| `prodex profiles` | `prodex scope --list` |

Running the old commands returns a guided error with the replacement.

#### `prodex trace` uses `--target` instead of `--entry`

`--entry` on `prodex trace` has been removed. Use `--target` to specify the file or module to trace from. To collect files by path or glob without tracing, use `prodex pack --entry`.

#### `--profile`, `--all-profiles`, and `--max-depth` replaced

| Old flag | New flag |
|---|---|
| `--profile <key>` | `prodex scope -k <key>` or `prodex pack --scope <key>` |
| `--all-profiles` | `prodex scope --all` |
| `--max-depth <n>` | `--depth <n>` |

Using the old flags now returns a guided error.

#### Artifact output

- **Cleaner section ordering.** Files appear before metadata in all commands. `prodex git` artifacts are an exception — Git metadata (status, diff-stat) appears first, followed by file contents.
- **Empty metadata sections are omitted** from the artifact.
- **Improved index and navigation.** The index includes accurate line ranges for files, metadata sections, and command outputs, with correct Previous / Next links throughout.
- **`prodex trace` artifacts** show the requested target, resolved starting file, and traversal depth in the index.

#### Glob excludes are now fully explicit

Previously, `node_modules/**`, `vendor/**`, and `dist/**` were silently excluded from all glob operations regardless of your config. These hidden ignores have been removed. Exclusions are now applied exclusively from your configured `exclude` list and any `--exclude` flags.

If you were relying on implicit exclusion of `vendor/` or `dist/`, add those patterns to `exclude` in your `prodex.json`:

```json
"exclude": ["node_modules/**", "vendor/**", "dist/**"]
```

The default config for new projects already includes these. Running `prodex migrate --write` will preserve whatever `exclude` entries your existing config has.

#### JS alias resolution is now config-driven

Previously, unresolved `@alias` imports fell back to a project-wide glob scan to find matching files. This fallback has been removed. Alias resolution now uses only the entries defined in your `aliases` config.

If traces were resolving aliases that you haven't explicitly configured, add them to `aliases` in `prodex.json`:

```json
"aliases": {
  "@": "resources/js",
  "@app": "src/app"
}
```

#### PHP and Laravel dependency tracing improved

The PHP resolver now handles `use` statement maps, namespace-aware short class name resolution, grouped `use` blocks, and PSR-4 mappings with multiple source directories per namespace. Laravel IoC container bindings from `bootstrap/providers.php` are used as resolution hints. PHP/Laravel projects will generally see more complete dependency traces.

---

### Migration notes

#### 1. Update `prodex.json` to config version 5

Config version 5 renames several fields. Loading a v4 config with v2.1.0 produces a hard error with migration instructions. Run the migration tool:

```bash
prodex migrate            # preview changes
prodex migrate --write    # back up and apply changes
```

`prodex migrate --write` creates a versioned backup (`prodex.v4.backup.json`) before updating `prodex.json`.

**Field renames (v4 → v5):**

| v4 field | v5 field |
|---|---|
| `profiles` | `scopes` |
| `resolve.aliases` | `aliases` (top-level) |
| `resolve.maxDepth` | `depth` (top-level) |
| `resolve.maxFiles` | `maxFiles` (top-level) |
| root `entry` | `scopes.default.entry` |
| root `include` | `scopes.default.include` |

#### 2. Update scripts and aliases using old CLI commands

Replace any uses of `prodex run`, `prodex profiles`, `--profile`, `--all-profiles`, or `--max-depth` using the table in the Changed section above. Replace `prodex trace --entry <file>` with `prodex trace --target <file>`. Running the old commands will print the exact replacement to use.

#### 3. Review your `exclude` config

If you haven't explicitly listed `node_modules/**`, `vendor/**`, or `dist/**` in your `exclude` config, add them now to preserve the previous exclusion behavior.

#### 4. Review JS alias config

If `prodex trace` was resolving imports for aliases not defined in your `aliases` config, add those aliases explicitly. The glob-based fallback that previously found them has been removed.

---

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
