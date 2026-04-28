<!-- This section is maintained by the coding agent via lore (https://github.com/BYK/loreai) -->
## Long-term Knowledge

### Architecture

<!-- lore:019dd01d-2e73-7c10-be87-d02b580e354a -->
* **Adding tree-sitter languages**: Adding tree-sitter languages requires wiring \`SupportedLanguage\`, \`languageConfig\`, AST parser WASM map, FS/AgentFS extension mappers, package catalog/dependency, CLI release WASM copy list, and AST chunker tests. Add parser builds to the postinstall \`TREE\_SITTER\_WASM\_BUILDS\` list; WASM files are generated/ignored, not committed.

### Gotcha

<!-- lore:019dd028-41bb-7c2f-88df-3f60058ef1e5 -->
* **NPM publish can partially succeed**: \`turbo run publish:npm\` publishes release packages in parallel, so one package can publish successfully before another fails. If retrying gets \`403 ... cannot publish over previously published versions\`, confirm with \`bun pm view \<pkg> version\` before assuming publish failed.

<!-- lore:019dd187-4d38-7436-a758-e53314efb0ed -->
* **YAML Tree-sitter WASM Package**: For YAML support, avoid unscoped \`tree-sitter-yaml@0.5.0\`: its WASM build fails with missing external scanner symbols. Use \`@tree-sitter-grammars/tree-sitter-yaml@0.7.1\` in the tree-sitter catalog and build path instead.

### Pattern

<!-- lore:019dd01d-2e73-7c10-be87-d02c8643df1a -->
* **AST chunker test convention**: AST chunker tests use \`@effect/vitest\`, \`it.effect\`, \`Layer.provide(BunContext.layer)\`, and Config fixtures must include both \`cwd\` and \`baseCwd\`. Run Vitest through Bun (\`bun --bun run ./node\_modules/.bin/vitest ...\`); plain Vitest lacks Bun globals and fails at \`Bun.YAML\`.

<!-- lore:019dd026-1ce7-7e06-a929-c9a0e262bc0f -->
* **CLI Version Sync**: CLI release version is sourced from root \`VERSION\`. \`bun run version:sync\` propagates it to \`packages/cli-dev/package.json\`, \`releases/cli/package.json\`, \`releases/cli-darwin-x64/package.json\`, and \`packages/cli-dev/src/index.ts\`; root \`bun run build\` runs this sync before Turbo build.

### Preference

<!-- lore:019dd022-8386-73ac-80ac-226ff2f7da44 -->
* **Use Bun Tooling**: This repo is a Bun monorepo. Do not use npm or pnpm for installs or scripts; use \`bun install\`, \`bun --bun run ...\`, and workspace filters such as \`bun --bun run --filter @grepai/core typecheck\`.
<!-- End lore-managed section -->
