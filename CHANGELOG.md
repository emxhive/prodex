# Changelog

## [2.0.0](https://github.com/emxhive/prodex/compare/v1.4.11...v2.0.0) (2026-05-21)


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
