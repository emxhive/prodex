# 🧩 Prodex v1.4.11

> **Build the maze, I'll write a map.**

Unified project indexer and dependency extractor for JavaScript/TypeScript, React, and Laravel stacks. Prodex recursively resolves imports, stitches them into a single Markdown or text artifact, and gives you a navigable, linkable map of the code you care about.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Usage](#cli-usage)
  - [Common Flags](#common-flags)
  - [Shortcuts & Batch Runs](#shortcuts--batch-runs)
- [Configuration (`prodex.json`)](#configuration-prodexjson)
- [Example Workflows](#example-workflows)
- [Output & Naming](#output--naming)
- [Roadmap](#roadmap)
- [License](#license)
- [Support](#support)

---

## Overview

Prodex runs entirely from the command line. Point it at one or more entry files, optionally add includes/excludes, and it will trace dependencies, gather referenced files, and emit a clean, versioned export. Markdown output is the default for easy navigation, but text mode is available for pipelines that prefer plain text.

> Interactive picker/UI is still experimental; prefer CLI flags or shortcuts for reliable runs.

---

## Features

| Status | Capability | Details |
| :---: | --- | --- |
| ✅ | Cross-language indexing | Resolves imports across JS/TS, React, and PHP (Laravel) projects. |
| ✅ | Markdown & text output | Markdown by default with anchors and fenced blocks; opt into `--txt` for `.txt`. |
| ✅ | Glob-driven selection | Uses [Fast-Glob](https://github.com/mrmlnc/fast-glob) for flexible include/exclude patterns. |
| ✅ | Custom naming & versioning | Outputs are versioned automatically; override prefix with `--name`. |
| ✅ | Shortcut runs | Define reusable entry/include/exclude sets in `prodex.json` and call them with `-a` or `@name`. |
| ⚠️ | Interactive picker | Available but unstable; disable with `--ci` or by providing files via CLI. |
| 🚧 | Smart file splitting | Planned for oversized combined outputs. |
| 🚧 | Deeper alias/PSR-4 resolution | Extended alias handling and PHP improvements are in progress. |

---

## Requirements

- Node.js **16+** (see `engines` in `package.json`)
- A project with resolvable entry files (JS/TS/React/PHP)
- Optional: `prodex.json` for saved defaults and shortcuts

---

## Installation

Install globally:

```bash
npm install -g prodex
```

Or run ad-hoc without installing:

```bash
npx prodex
```

Generate a starter config at any time:

```bash
prodex init
```

---

## Quick Start

1. Choose an entry point (e.g., `routes/web.php` or `resources/js/app.tsx`).
2. Run Prodex with include/exclude globs as needed:

   ```bash
   prodex -f "**/web.php,**/app.tsx" -i "**/*.d.ts" -x "node_modules/**"
   ```

3. Find your versioned output in `./prodex/` (Markdown by default).

---

## CLI Usage

Basic syntax:

```bash
prodex [root] --files "**/app.tsx" --include "**/*.d.ts" --exclude "node_modules/**"
```

Provide globs as comma-separated lists and wrap them in quotes when they contain special characters.

### Common Flags

| Flag | Short | Type | Description |
| --- | --- | --- | --- |
| `--files` | `-f` | list | Entry files to trace (comma-separated globs). |
| `--include` | `-i` | list | Extra files/patterns appended without dependency resolution (e.g., `.d.ts`). |
| `--exclude` | `-x` | list | Patterns or folders to skip during traversal. |
| `--name` | `-n` | string | Custom output prefix (versioning still applies). |
| `--txt` | `-t` | boolean | Output plain text instead of Markdown. |
| `--limit` | `-l` | number | Override traversal limit for very large graphs. |
| `--ci` | `-c` | boolean | Headless mode; skips interactive picker/UI. |
| `--debug` | `-d` | boolean | Emit debug logs during traversal. |
| `--shortcut` | `-a` | string | Apply a named shortcut defined in `prodex.json`. |
| `--help` | `-h` | boolean | Show CLI help and exit. |

### Shortcuts & Batch Runs

- Define reusable sets in `prodex.json` under `shortcuts`.
- Invoke one shortcut: `prodex -a dashboard` or `prodex @dashboard`.
- Run multiple shortcuts in sequence: `prodex @dashboard @api`.
- Run all shortcuts at once: `prodex @` (or provide `--shortcutAll`).

---

## Configuration (`prodex.json`)

`prodex.json` is optional but recommended for saved defaults, UI preferences, and shortcuts. Generate one with `prodex init`.

Example:

```json
{
  "version": 3.1,
  "$schema": "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
  "output": { "dir": "prodex", "versioned": true, "prefix": "combined", "format": "md" },
  "entry": {
    "files": ["src/index.ts"],
    "ui": { "roots": ["app", "routes", "resources/js/**"], "scanDepth": 2, "priority": ["**/routes/web.php"] }
  },
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

- CLI flags always override config values for a run.
- Disable the picker by setting `entry.ui.enablePicker: false` or by using `--ci`/`--files`.

---

## Example Workflows

- **AI context packs**  
  `prodex -f "**/dashboard.tsx" -i "**/*.d.ts,**/*.interface.ts" -n "dashboard-map"`

- **Backend + frontend maps**  
  `prodex -f "**/(web|api).php,**/app.tsx" -x "node_modules/**" -n "full-stack"`

- **Shortcut-driven runs**  
  Save shortcuts in `prodex.json`, then execute `prodex @api @dashboard` to build multiple exports in sequence.

- **CI-safe export**  
  `prodex -f "src/index.ts" --ci --txt` for a headless text export.

---

## Output & Naming

- Default output directory: `./prodex/`
- Default prefix: `combined` (override with `--name`)
- Versioned filenames to prevent accidental overwrites
- Formats: `md` (default) or `txt` via `--txt`
- Each export contains anchors and back-to-top links for quick navigation across large files.

---

## Roadmap

- Smarter alias resolution and PSR-4 scanning for PHP projects
- Performance optimizations for very large dependency graphs
- Smart splitting for oversized combined outputs
- Continued stabilization of the interactive picker

---

## License

**MIT License**  
© 2025 [emxhive](https://github.com/emxhive)

---

## Support

Prodex ships frequent updates. If you encounter rough edges (especially around interactive mode or advanced resolvers), update to the latest version and rerun. Feedback and issues are welcome. ❤️
