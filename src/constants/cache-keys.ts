export const CACHE_KEYS = {
	ALIASES: "aliases",
	JS_IMPORTS: "js:imports",
	JS_STATS: "js:stats",
	PHP_PSR4: "php:psr4",
	PHP_BINDINGS: "php:bindings",
	PHP_FILECACHE: "php:fileCache",
} as const;

export type CacheNamespace = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];
