# 🧩 Prodex — Unified Project Indexer & Dependency Extractor

> **Prodex** *(short for “Project Index”)* — a cross-language dependency combiner for modern full-stack applications.  
> Traverses **Laravel + React + TypeScript** projects to generate a single, organized view of your project’s true dependency scope.

---

## 🧠 Recent Fixes & Updates — v1.0.4

- 🪟 **Windows path resolution fixed** — now uses proper `file://` URLs for full ESM compatibility.  
- 🧾 **Improved output naming** — automatic, context-aware filenames (e.g. `prodex-[entries]-combined.txt`).  
- ⚙️ **“Yes to all” confirmation added** — skip repetitive prompts during CLI runs.

---

## 🚀 Features

| Feature | Description |
|----------|-------------|
| ⚙️ **Cross-language resolver** | Parses JS/TS (`import`, `export`) and PHP (`use`, `require`, `include`) dependency trees. |
| 🧭 **Alias detection** | Reads `tsconfig.json` and `vite.config.*` for alias paths (`@/components/...`). |
| 🧩 **Laravel-aware** | Maps PSR-4 namespaces and detects providers under `app/Providers`. |
| 🔄 **Recursive chain following** | Resolves dependency graphs up to a configurable depth and file limit. |
| 🪶 **Clean unified output** | Merges all resolved files into a single `.txt` file with region markers for readability. |
| 🧠 **Static & safe** | Fully static parsing — no runtime execution or file modification. |
| 💬 **Interactive CLI** | Select files, confirm settings, or use “Yes to all” for streamlined automation. |

---

## 📦 Installation

```bash
npm install -g prodex
```

or locally:

```bash
npm install --save-dev prodex
```

---

## 🧰 Usage

Run from your project root:

```bash
prodex
```

or:

```bash
npx prodex
```

You’ll be guided through an interactive CLI:

```
🧩 Prodex — Project Indexer
🧩 Active Config:
 • Output Directory: ./prodex/
 • Scan Depth: 2
 • Base Dirs: app, routes, resources/js
```

After selecting entries:

```
✅ prodex-[entries]-combined.txt written (12 file(s)).
```

---

## 🗂 Output Example

```
## ==== path: app/Services/Shots/ComputeService.php ====
## #region app/Services/Shots/ComputeService.php
<?php
// your code here...
## #endregion
```

---

## ⚙️ Configuration

Optional `.prodex.json` (in project root):

```json
{
  "$schema": "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
  "output": "prodex",
  "scanDepth": 2,
  "limit": 200,
  "baseDirs": ["app", "routes", "resources/js"],
  "aliasOverrides": {
    "@hooks": "resources/js/hooks",
    "@data": "resources/js/data"
  },
  "entryExcludes": [
    "resources/js/components/ui/",
    "app/DTOs/"
  ],
  "importExcludes": [
    "node_modules",
    "@shadcn/"
  ]
}
```

---

## ⚡ CLI Flags (UNTESTED)

| Flag | Description |
|------|-------------|
| `--limit <n>` | Override max dependency count |
| `--output <dir>` | Custom output directory |
| `--depth <n>` | Set scan depth |
| `--no-chain` | Disable dependency chain following |
| `--debug` | Enable verbose logging |

Example:
```bash
prodex --depth 3 --output ./dump --limit 500
```

---

## 🧩 Workflow Overview

1. **Config Loader** — merges `.prodex.json` with defaults and alias maps.  
2. **Resolvers** —  
   - JS/TS: follows imports, re-exports, dynamic imports.  
   - PHP: expands `use`, grouped imports, PSR-4 mappings.  
3. **Combiner** — normalizes indentation, strips comments, merges all code into one readable combined file.

---

## 🧱 Example: Laravel + React

```bash
prodex
```

```
🧩 Following dependency chain...
✅ prodex-app-routes-combined.txt written (24 file(s)).
```

Included files:
```
resources/js/pages/accounts.tsx
app/Http/Controllers/Shots/AccountsController.php
app/Repositories/Shots/FireflyApiRepository.php
app/Enums/Shots/Granularity.php
app/Support/Shots/CacheKeys.php
...
```

---

## 🧠 Ideal Use Cases

- 📦 Generate single-file **project snapshots**  
- 🤖 Provide structured context for **AI assistants**  
- 🧩 Perform **dependency audits** or code reviews  
- 📄 Simplify documentation and onboarding  

---

## 🔮 Upcoming Features

- 📝 **Markdown export** (`.md`) with automatic code fences  
- 📦 **Configurable output formats** (txt / md)  
- ⚡ **Alias auto-discovery for Laravel Mix and Next.js**  

---

## 🧾 License

**MIT © 2025 [emxhive](https://github.com/emxhive)**  
Issues and contributions welcome:  
👉 [github.com/emxhive/prodex/issues](https://github.com/emxhive/prodex/issues)

---

**Prodex** — *because every project deserves a clear map, not a maze.*
