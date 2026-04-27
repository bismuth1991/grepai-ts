<!-- This section is maintained by the coding agent via lore (https://github.com/BYK/loreai) -->
## Long-term Knowledge

### Architecture

<!-- lore:019dd01d-2e73-7c10-be87-d02b580e354a -->
* **Adding tree-sitter languages**: Adding tree-sitter languages requires wiring \`SupportedLanguage\`, \`languageConfig\`, AST parser WASM map, FS and AgentFS extension mappers, package catalog/dependency, postinstall WASM build, CLI release WASM copy list, and AST chunker tests. Parser WASM files are generated/ignored; update build/copy scripts rather than committing the generated WASM.

### Pattern

<!-- lore:019dd01d-2e73-7c10-be87-d02c8643df1a -->
* **AST chunker test convention**: AST chunker tests use \`@effect/vitest\`, \`it.effect\`, \`Layer.provide(BunContext.layer)\`, and Config fixtures must include both \`cwd\` and \`baseCwd\`. Run Vitest through Bun (\`bun --bun run ./node\_modules/.bin/vitest ...\`); plain Vitest lacks Bun globals and fails at \`Bun.YAML\`.

<!-- lore:019dd026-1ce7-7e06-a929-c9a0e262bc0f -->
* **CLI Version Sync**: CLI release version is sourced from root \`VERSION\`. \`bun run version:sync\` propagates it to \`packages/cli-dev/package.json\`, \`releases/cli/package.json\`, and \`packages/cli-dev/src/index.ts\`; root \`bun run build\` runs this sync before Turbo build.

### Preference

<!-- lore:019dd022-8386-73ac-80ac-226ff2f7da44 -->
* **Use Bun Tooling**: This repo is a Bun monorepo. Do not use npm or pnpm for installs or scripts; use \`bun install\`, \`bun --bun run ...\`, and workspace filters such as \`bun --bun run --filter @grepai/core typecheck\`.
<!-- End lore-managed section -->
