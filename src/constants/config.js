export const ROOT = process.cwd();
export const OUT_FILE = ROOT + "/combined.txt";
export const CODE_EXTS = [".ts", ".tsx", ".d.ts", ".php"];
export const ENTRY_EXCLUDES = [
  "resources/js/components/ui/",
  "app/Enums/",
  "app/DTOs/",
  "app/Models/",
  "app/Data/",
  "resources/js/wayfinder/",
  "resources/js/routes/",
  "resources/js/actions/",
  "resources/js/hooks/"
];
export const IMPORT_EXCLUDES = [
  "node_modules",
  "@shadcn/",
  "@/components/ui/",
  "@components/ui/",
  "resources/js/components/ui/",
  "resources/js/hooks/",
  "resources/js/wayfinder/",
  "resources/js/routes/",
  "resources/js/actions/"
];
export const BASE_DIRS = ["app", "routes", "resources/js"];
