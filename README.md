# 🧩 Prodex v1.2.0

> **Build the maze, I'll write a map.**

---

## 🧠 What’s New — v1.2.0

- 🆕 **Full CLI support with integrated [Sade](https://github.com/lukeed/sade).**  
  Prodex now runs entirely from the terminal — no `prodex.json` required.  
  Supports short flags and native glob patterns for flexible targeting.

     ```bash
     prodex -f "**/web.php,**/app.tsx" -i "**/*.d.ts" -x "node_modules/**"
     ```

     ```bash
     prodex --files "**/web.php,**/app.tsx" --include **/*types.ts --exclude "@shadcn/**"
     ```

- 🧾 **Markdown mode added and now default.**  
  Output is fully fenced and linkable — jump between the index and any code block.  
  Text mode remains available using `--txt` or `-t`.

- 🗂 **Output naming improved.**  
  Output files are now versioned by default.  
  Custom names are supported using `--name` or `-n`.  
  Naming conventions have been updated for cleaner, consistent results.

---

## ⚙️ Usage

Prodex v1.2.0 runs entirely from the command line.  
Interactive mode is currently unstable — use CLI flags instead.

### Installation

```bash
npm install -g prodex
```

Or run without installing:

```bash
npx prodex
```

---

### Basic Run

```bash
prodex -f "**/web.php,**/app.tsx"
```

### With Includes, exclude, and Custom Name

```bash
prodex -f "**/web.php,**/app.tsx" -i "**/*.d.ts" -x "node_modules/**" -n "combined-output"
```

### Flag Reference

| Flag        | Short | Description                                                                                                                                             |
| ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--files`   | `-f`  | Entry files — starting points for dependency resolution. Accepts multiple names or globs.                                                               |
| `--include` | `-i`  | Adds extra files or patterns to include (e.g. `.d.ts`, interface, or type files). These files are **not dependency-resolved** — they’re appended as-is. |
| `--exclude` | `-x`  | Patterns or folders to skip during the scan.                                                                                                            |
| `--name`    | `-n`  | Custom output filename (without extension). Versioning still applies automatically.                                                                     |

> Globs are powered by [Fast-Glob](https://github.com/mrmlnc/fast-glob).  
> Use **comma-separated values** for multiple entries.  
> Wrap globs in quotes when they include special characters like `|` or `&`.

---

## 🧭 Plans

- **Alias Resolution Improvements**  
  Planned overhaul of alias handling to support deeper nested paths, wildcard matching, and auto-mapped imports across mixed stacks.

- **Language Support**  
  Currently supports **JavaScript**, **React**, and **Laravel + React** stacks.  
  May work with other frameworks but remains untested.  
  Broader multi-language support is planned for future versions.

- **Combined Output**  
  All code from multiple entries is merged into a single output file.  
  There’s currently **no limit** on output size, but it’s advised to avoid combining _too many large entries_ in a single run.  
  Future versions will include **smart naming** and **automatic splitting** for oversized outputs.

- **Performance Optimizations**  
  Planned improvements to resolver speed and dependency traversal for faster processing on large projects.

---

## 🧩 Features

| Status | Feature                     | Description                                                                                    |
| :----: | --------------------------- | ---------------------------------------------------------------------------------------------- |
|   ✅   | **Cross-language indexing** | Resolves imports across JS, TS, React, and PHP (Laravel) projects.                             |
|   ✅   | **Markdown output**         | Generates clean `.md` files with anchors, back-to-top links, and fenced code blocks.           |
|   ✅   | **Text output**             | Optional `.txt` mode using `--txt` or `-t`.                                                    |
|   ✅   | **Glob support**            | Works with flexible glob patterns powered by [Fast-Glob](https://github.com/mrmlnc/fast-glob). |
|   ✅   | **Custom output names**     | Define your own output prefix using `--name` or `-n`.                                          |
|   ⚠️   | **Interactive picker (UI)** | Still unstable — not recommended for production use.                                           |
|   ⚠️   | **Alias resolution**        | Basic alias mapping supported; advanced cases in progress.                                     |
|   🚧   | **Smart file splitting**    | Planned for large combined outputs.                                                            |
|   🚧   | **PSR-4 deep scan**         | Planned to improve PHP dependency resolution.                                                  |
|   🚧   | **Speed optimization**      | Further resolver and I/O improvements under development.                                       |

---

## 🧱 Use Cases

Prodex can technically combine your entire codebase into one file —  
but it’s **best used in parts**, focusing on specific sections or features.  
Each run produces a clean, self-contained map showing all related files and dependencies.

### 🧩 Common Scenarios

- **🤖 Project Awareness for AI Assistants**  
  Generate compact `.md` summaries of key parts of your project.  
  These can be shared with AI tools (like ChatGPT, Claude, or Copilot) to give them structured context about your codebase — without exposing unnecessary files.

- **📦 Feature or Module Mapping**  
  Combine everything connected to a specific feature (e.g., `Checkout`, `Dashboard`, or `Payments`).  
  Prodex gathers all linked imports, helpers, and files into one readable document.

- **🔍 Dependency Insight**  
  Trace how a particular entry file connects through your stack — whether it’s `app.tsx` on the frontend or `routes/web.php` on the backend.  
  Great for debugging, refactoring, or understanding cross-stack dependencies.

- **📖 Documentation Bundles**  
  Create readable Markdown maps per module or domain instead of one large export.  
  Each output acts as a focused, navigable view of your code relationships.

- **🧠 Team Handoffs**  
  Share isolated code scopes (like `Auth`, `Payments`, or `User Management`) with full dependency context.  
  Makes onboarding and code reviews significantly faster.

---

## 🧩 Recommended Workflow

Prodex works best when used to **map and export projects in logical parts** rather than all at once.  
Each run focuses on one or more entry points, and Prodex automatically **loads all imports recursively** for those files —  
then appends any files matched by the `--include` flag.

### 🧠 Suggested Pattern

1. **Pick a meaningful entry file**  
   Example:

      - Frontend: `resources/js/**/dashboard.tsx`
      - Backend: `routes/**/(web|api).php`
      - Shared logic: `app/Services/**/PaymentService.php`

2. **Run Prodex with includes for type or interface files**

      ```bash
      prodex -f "**/dashboard.tsx" -i "**/*.d.ts,**/*.interface.ts"
      ```

3. **Export separate maps for each major area**

      ```bash
      prodex -f "**/dashboard.tsx" -n "dashboard-map"
      prodex -f "**/(web|api).php" -n "backend-map"
      ```

4. **Use them together**  
   Store each output in `/prodex/`
   These maps can be shared with teammates or loaded into AI tools for structured, code-aware assistance.

> ⚡ Each run recursively resolves every import, applies includes, and outputs one complete dependency map for that section.

---

## ⚙️ Optional — `prodex.json`

`prodex.json` is **fully optional** in v1.2.0.  
You can run Prodex entirely from the command line, but the config file can be useful for saved defaults.

### 🪄 Quick Setup

You can generate a ready-to-use config file with:

```bash
prodex init
```

This creates a `prodex.json` file in your project root with sensible defaults — including base directories, globs, and priority files.

### 🧩 Running with a Config File

If you’ve defined your entry files in the config under `entry.files`,  
you can run Prodex directly without specifying `--files`:

```bash
prodex -c
```

The `-c` (or `--ci`) flag skips interactive mode and uses the config values automatically.  
Specifying `-f` ( or `--files`) from the CLI also disables the picker by default.

You can permanently disable the picker in the config by setting:

```json
"entry": {
  "ui": {
    "enablePicker": false
  }
}
```

---

## 📜 License

**MIT License**  
© 2025 [emxhive](https://github.com/emxhive)

---

## ⚠️ Note from the Author

Prodex is still a **work in progress**.  
Some parts of the experience may be rough, especially around interactive mode and advanced resolvers.  
Updates are released **multiple times per week — sometimes daily** — to keep improving stability and support.

Please stay up to date for the best experience.  
Thank you for testing Prodex early. ❤️
