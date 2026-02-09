# @grepai/cli

Semantic code search CLI. It indexes your codebase using vector embeddings to enable natural language queries that find relevant code by meaning, regardless of naming conventions.

## Installation

```bash
bun add -g @grepai/cli
```

## Usage

```bash
# Index your codebase (run whenever code changes)
grepai index

# Search using natural language
grepai search "how is user authentication handled?"

# Options: --topK (default 20)
grepai search "database config" --topK 50
```

## Configuration

Create a `.grepairc.json` or `grepai-config.json` in your project root. Supports `${ENV_VAR}` substitution.

```json
{
  "$schema": "https://raw.githubusercontent.com/bismuth1991/grepai-ts/refs/heads/main/packages/core/src/grepai-config-schema.json",
  "storage": {
    "type": "turso",
    "url": "${TURSO_DB_URL}",
    "authToken": "${TURSO_DB_AUTH_TOKEN}"
  },
  "embedding": {
    "provider": "google",
    "model": "gemini-embedding-001",
    "apiKey": "${GEMINI_API_KEY}",
    "dimensions": 3072
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

Read `https://github.com/bismuth1991/grepai-ts/blob/main/packages/core/src/domain/config.ts` for full configuration details.

## Links

[Repository](https://github.com/bismuth1991/grepai-ts) | [Issues](https://github.com/bismuth1991/grepai-ts/issues) | [License](LICENSE)
