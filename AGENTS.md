<!-- This section is maintained by the coding agent via lore (https://github.com/BYK/loreai) -->
## Long-term Knowledge

### Architecture

<!-- lore:019dd01d-2e73-7c10-be87-d02b580e354a -->
* **Adding tree-sitter languages**: Adding tree-sitter languages requires wiring \`SupportedLanguage\`, \`languageConfig\`, AST parser WASM map, FS/AgentFS extension mappers, package catalog/dependency, postinstall \`TREE\_SITTER\_WASM\_BUILDS\`, CLI release WASM copy list, AST chunker tests, and supported-language docs such as \`releases/cli/README.md\`. WASM files are generated/ignored, not committed.

<!-- lore:019dd19b-b41d-795e-a61b-0aa020ec2540 -->
* **GrepAi Layer Selection**: \`GrepAiLive\` composes services from \`Config\`: storage selects SQL vs LanceDB, embedding selects Gemini/OpenAI, tokenizer selects simple/Gemini/tiktoken, and \`experimental\_\_agentFs\` swaps scanner/reader implementations. Tests for high-level behavior should fake these dependencies via Effect layers rather than instantiating the full runtime.

### Gotcha

<!-- lore:019dd19b-b41d-795e-a61b-0aa1351da166 -->
* **Config Loading Precedence**: CLI config lookup tries \`.grepai/.${project}.grepairc.json\`, \`.grepai/.grepairc.json\`, \`.grepairc.json\`, then \`grepai-config.json\`. Env interpolation uses \`${NAME}\` and missing variables fail with \`MissingEnv\`; AgentFS \`syncMode\` is stripped unless the index runtime enables sync mode.

<!-- lore:019dd028-41bb-7c2f-88df-3f60058ef1e5 -->
* **NPM publish can partially succeed**: \`turbo run publish:npm\` publishes release packages in parallel, so one package can publish successfully before another fails. If retrying gets \`403 ... cannot publish over previously published versions\`, confirm with \`bun pm view \<pkg> version\` before assuming publish failed.

<!-- lore:019dd187-4d38-7436-a758-e53314efb0ed -->
* **YAML Tree-sitter WASM Package**: For YAML support, avoid unscoped \`tree-sitter-yaml@0.5.0\`: its WASM build fails with missing external scanner symbols. Use \`@tree-sitter-grammars/tree-sitter-yaml@0.7.1\` in the tree-sitter catalog and build path instead.

### Pattern

<!-- lore:019dd01d-2e73-7c10-be87-d02c8643df1a -->
* **AST chunker test convention**: AST chunker tests use \`@effect/vitest\`, \`it.effect\`, and shared helpers from \`packages/core/src/tests/test-harness.ts\` (\`makeChunkerAstTestLayer\`, \`makeTestConfig\`, \`makeConfigTestLayer\`, \`TokenCounterTest\`, \`extractContextHeader\`). Run Vitest through Bun (\`bun --bun run ./node\_modules/.bin/vitest ...\`); plain Vitest lacks Bun globals and fails at \`Bun.YAML\`.

<!-- lore:019dd026-1ce7-7e06-a929-c9a0e262bc0f -->
* **CLI Version Sync**: CLI release version is sourced from root \`VERSION\`. \`bun run version:sync\` propagates it to \`packages/cli-dev/package.json\`, \`releases/cli/package.json\`, \`releases/cli-darwin-x64/package.json\`, and \`packages/cli-dev/src/index.ts\`; root \`bun run build\` runs this sync before Turbo build.

<!-- lore:019dd19b-b41c-715b-8aa4-93ad0c67845f -->
* **Test Coverage Priorities**: Existing tests are concentrated in \`packages/core/src/tests\` around \`ChunkerAst\`. When adding tests, prioritize shared Effect test layers/fakes, then config loading, scanner/indexer orchestration, SQL storage integration, CLI handlers, and tighter chunker invariants instead of broad \`length > 0\` assertions.

### Preference

<!-- lore:019dd022-8386-73ac-80ac-226ff2f7da44 -->
* **Use Bun Tooling**: This repo is a Bun monorepo. Do not use npm or pnpm for installs or scripts; use \`bun install\`, \`bun --bun run ...\`, and workspace filters such as \`bun --bun run --filter @grepai/core typecheck\`.
<!-- End lore-managed section -->
