# 🧩 Prodex — Unified Project Indexer & Dependency Extractor

> **Prodex** *(short for “Project Index”)* — a cross-language dependency combiner for modern full-stack applications.  
> Traverses **Laravel + React + TypeScript** projects to generate a single, organized view of your project’s true dependency scope.

---

## 🧠 Recent Fixes & Updates — v1.0.6
- ⭐ **Priority Files Support**  — priority files will now appear **first** on the entry selection list.

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
  ], 
  "priorityFiles": [
  "routes/web.php",
  "routes/api.php",
  "index",
  "main",
  "app"
]
}
```

```



```



Files are matched using `.includes()` (case-insensitive), so `"index"` will match `src/index.js`, `app/index.tsx`, etc.  
Recommended entries appear at the top of the picker under a **⭐ Recommended entries** section.





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

**Prodex** — *Codebase, decoded*

