# Changelog

## [3.0.0](https://github.com/emxhive/prodex/compare/v2.0.0...v3.0.0) (2026-05-21)


### ⚠ BREAKING CHANGES

* **release:** Prodex 2.0.0 includes accumulated CLI, config, output, runtime, and package-surface breaking changes since 1.4.11. Existing users should migrate prodex.json to version 4, update shortcut usage to profiles, use explicit `prodex run` commands, and run on Node.js 22 or newer.

### Features

* add priorityFiles feature to configuration and update related components ([2cbebb6](https://github.com/emxhive/prodex/commit/2cbebb6534034998c7bad2ec6d5f39ccfa4bf6ae))
* add support for config shortcuts and enhance CLI input parsing ([0ff564f](https://github.com/emxhive/prodex/commit/0ff564fcdf51a3ff9ace4b16debdc83d1cc6c443))
* **config:** use profile key as default output name ([187d68e](https://github.com/emxhive/prodex/commit/187d68ef3f5d5026f90c18028b05eab926ed7860))
* enhance applyShortcuts method for improved shortcut handling ([4742d74](https://github.com/emxhive/prodex/commit/4742d74bfd288077f98e25e332fd0a63445ca4cd))
* enhance configuration handling and improve alias resolution logic ([4671126](https://github.com/emxhive/prodex/commit/46711264fa98953d03f0dfc6f6d5e20dd90a671a))
* enhance logging in CacheManager and improve Laravel bindings extraction ([4f35a79](https://github.com/emxhive/prodex/commit/4f35a79c2e3737fc394850331d5474f22b6091a0))
* Enhance Prodex CLI and configuration management ([2f98457](https://github.com/emxhive/prodex/commit/2f98457e57c8303ce0542a82a633a5b4c759a97a))
* Implement central cache manager for alias resolution and enhance alias handling ([3d2a340](https://github.com/emxhive/prodex/commit/3d2a3405923a9e3af31850b620553a016556d7d7))
* Implement output generation and user prompt functionality ([bf583c7](https://github.com/emxhive/prodex/commit/bf583c757731866e7db96df662991de75c7d1a87))
* implement Prodex CLI with configuration wizard, entry picker, and summary display ([e2249e3](https://github.com/emxhive/prodex/commit/e2249e32b9e8114e4dcde5246999c02893200a93))
* Implement unified CLI parser and flag definitions ([d8c9874](https://github.com/emxhive/prodex/commit/d8c98741dc338ed949171a6e5b25268c0ce6b217))
* integrate ts-json-schema-generator for schema generation ([8a9d1e4](https://github.com/emxhive/prodex/commit/8a9d1e46a8a590dcc7a6fc6628121f6eabed8339))
* Refactor CLI input parsing and configuration handling; update flag definitions and logging levels ([ea1611e](https://github.com/emxhive/prodex/commit/ea1611e92493f8606545c78ed703d69e986c5ac5))
* refactor configuration handling and improve JSON serialization ([1ea7ae3](https://github.com/emxhive/prodex/commit/1ea7ae3774e18a3ebd83e223d9f148adbffdd575))
* **release:** automate npm publishing ([c5d04fd](https://github.com/emxhive/prodex/commit/c5d04fd0e8df71f01de69befd2509014d8b77f57))
* remove setup.sh script and update .gitignore to exclude it ([7687e00](https://github.com/emxhive/prodex/commit/7687e00a5880297848d29c462d292f6439b66951))
* update .gitignore and prodex.json for improved configuration management ([2915322](https://github.com/emxhive/prodex/commit/29153229b543782dea26f9404159854cb68ba301))
* update exclusion logic in isExcluded function for improved path handling ([d6676d1](https://github.com/emxhive/prodex/commit/d6676d129edd7a72ec068fd339f13b607de14c96))
* update prodex.json and prodex.schema.json for schema alignment and remove unused shortcuts ([1157da2](https://github.com/emxhive/prodex/commit/1157da299d662ce13f69c8e46bed49e0bb42d82e))
* update ProdexConfigFile to use DeepPartial for improved flexibility ([7eef9ef](https://github.com/emxhive/prodex/commit/7eef9ef496d6df2639bb83541d00f4e5f4c174bc))
* update README and configuration to support priority files, enhance path resolution, and improve installation instructions ([a330de8](https://github.com/emxhive/prodex/commit/a330de8efc0d2485c426329c912f8ddad3c20151))
* update README for v1.0.8 and fix PHP resolver path separator ([ecfef21](https://github.com/emxhive/prodex/commit/ecfef21ff3006aead1b783bea3a4e5309be91e82))
* Update README for v1.1.0; enhance CLI support, improve output naming, and refine configuration options ([71613ea](https://github.com/emxhive/prodex/commit/71613ea8d93ae9693a8eac437b533e717ee09cca))
* update resolver logic to track expected and resolved imports in JS and PHP ([998b7f4](https://github.com/emxhive/prodex/commit/998b7f4185d5ea5ccaf6b9942f220e2d1ff3ce27))
* update schema property to $schema and add shortcuts configuration ([2808b6f](https://github.com/emxhive/prodex/commit/2808b6f2dc5d7da3daa829938ecb0301ba7b51ad))


### Miscellaneous Chores

* **release:** prepare 2.0.0 ([8071809](https://github.com/emxhive/prodex/commit/80718090184f7aa5370254e393956f4cf569124c))

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
