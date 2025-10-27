export const DEFAULT_PRODEX_CONFIG = {
  $schema: "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
  outDir: "prodex",
  scanDepth: 2,
  limit: 200,
  resolverDepth: 10,

  entry: {
    includes: ["app", "routes", "resources/js"],
    excludes: [
      "**/components/ui/**",
      "**/DTOs/**",
      "**/Enums/**"
    ],
    priority: [
      "**/routes/web.php",
      "**/routes/api.php",
      "**/*index.*",
      "**/*main.*",
      "**/app.*"
    ]
  },

  imports: {
    includes: ["**/*.d.ts", "**/*.interface.ts"],
    excludes: [
      "node_modules/**",
      "@shadcn/**",
      "**/components/ui/**"
    ],
    aliases: {
      "@hooks": "resources/js/hooks",
      "@data": "resources/js/data"
    }
  }
};
