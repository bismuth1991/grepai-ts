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

### Minimal Example (Turso)

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
    "apiKey": "${GEMINI_API_KEY}"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Postgres Example

```json
{
  "storage": {
    "type": "postgres",
    "connectionString": "postgres://user:pass@localhost:5432/grepai"
  },
  "embedding": {
    "provider": "google",
    "model": "gemini-embedding-001",
    "apiKey": "${GEMINI_API_KEY}",
    "dimensions": 1536
  }
}
```

### Advanced Configuration

Full list of options:

```json
{
  "embedding": {
    "provider": "google",
    "model": "gemini-embedding-001",
    "apiKey": "${GEMINI_API_KEY}",
    "dimensions": 3072,           // 768, 1536, or 3072
    "targetChunkSize": 256,       // Preferred tokens per chunk
    "maxChunkSize": 1024,         // Max tokens per chunk
    "tokenizer": "gemini-embedding-001" // or "simple"
  }
}
```

Read `https://github.com/bismuth1991/grepai-ts/blob/main/packages/core/src/domain/config.ts` for full configuration details.

## How it works

1.  **AST Parsing**: GrepAI parses your code (TypeScript/TSX) into an Abstract Syntax Tree.
2.  **Smart Chunking**: It splits code into meaningful chunks, preserving scope context (class names, function signatures) even for deep nested code.
3.  **Embedding**: Chunks are embedded using Google's Gemini models.
4.  **Vector Search**: Queries are embedded and compared against code chunks using cosine similarity.

## Links

[Repository](https://github.com/bismuth1991/grepai-ts) | [Issues](https://github.com/bismuth1991/grepai-ts/issues) | [License](LICENSE)
