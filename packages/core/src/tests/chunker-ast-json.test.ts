import { BunContext } from '@effect/platform-bun'
import { describe, it, expect } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { Chunker } from '../domain/chunker'
import { Config } from '../domain/config'
import { TokenCounter } from '../domain/token-counter'
import { ChunkerAst } from '../internal/services/chunker-ast'
import { AstParser } from '../internal/services/chunker-ast/ast-parser'
import { ContextHeaderBuilder } from '../internal/services/chunker-ast/context-header-builder'

const TokenCounterTest = Layer.succeed(TokenCounter, {
  count: (content: string) => Effect.succeed(Math.ceil(content.length / 4)),
})

const SmallChunkConfig = Layer.succeed(Config, {
  cwd: '/test',
  embedding: {
    provider: 'google',
    model: 'gemini-embedding-001',
    apiKey: 'test-key',
    targetChunkSize: 50,
    maxChunkSize: 100,
    dimensions: 3072,
    tokenizer: 'simple',
  },
  include: [],
  exclude: [],
  storage: {
    type: 'turso',
    url: 'test',
    authToken: 'test',
  },
})

const LargeChunkConfig = Layer.succeed(Config, {
  cwd: '/test',
  embedding: {
    provider: 'google',
    model: 'gemini-embedding-001',
    apiKey: 'test-key',
    targetChunkSize: 500,
    maxChunkSize: 1000,
    dimensions: 3072,
    tokenizer: 'simple',
  },
  include: [],
  exclude: [],
  storage: {
    type: 'turso',
    url: 'test',
    authToken: 'test',
  },
})

const TinyChunkConfig = Layer.succeed(Config, {
  cwd: '/test',
  embedding: {
    provider: 'google',
    model: 'gemini-embedding-001',
    apiKey: 'test-key',
    targetChunkSize: 15,
    maxChunkSize: 30,
    dimensions: 3072,
    tokenizer: 'simple',
  },
  include: [],
  exclude: [],
  storage: {
    type: 'turso',
    url: 'test',
    authToken: 'test',
  },
})

const TestLive = ChunkerAst.pipe(
  Layer.provide(AstParser.Default),
  Layer.provide(ContextHeaderBuilder.Default),
  Layer.provide(TokenCounterTest),
  Layer.provide(SmallChunkConfig),
  Layer.provideMerge(BunContext.layer),
)

const TestLiveLargeChunks = ChunkerAst.pipe(
  Layer.provide(AstParser.Default),
  Layer.provide(ContextHeaderBuilder.Default),
  Layer.provide(TokenCounterTest),
  Layer.provide(LargeChunkConfig),
  Layer.provideMerge(BunContext.layer),
)

const TestLiveTinyChunks = ChunkerAst.pipe(
  Layer.provide(AstParser.Default),
  Layer.provide(ContextHeaderBuilder.Default),
  Layer.provide(TokenCounterTest),
  Layer.provide(TinyChunkConfig),
  Layer.provideMerge(BunContext.layer),
)

function extractContextHeader(content: string) {
  const [header = ''] = content.split('\n---\n')
  return header
}

describe('ChunkerAst JSON Support', () => {
  describe('basic JSON parsing', () => {
    it.effect('chunks a simple key-value pair', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/config.json',
          content: '{"name":"grepai"}',
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('"name"')
        expect(result[0]!.content).toContain('"grepai"')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks an object with multiple keys', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/settings.json',
          content: `{
  "name": "grepai",
  "version": "1.0.0",
  "private": true
}`,
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('"version"')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks a nested object', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/nested.json',
          content: `{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true
  }
}`,
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
        const combined = result.map((chunk) => chunk.content).join('\n')
        expect(combined).toContain('"compilerOptions"')
        expect(combined).toContain('"strict"')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks an array', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/list.json',
          content: '{"items":["a","b","c"]}',
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('"items"')
        expect(result[0]!.content).toContain('"a"')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks array of objects', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/users.json',
          content: `{
  "users": [
    { "id": 1, "name": "Ada" },
    { "id": 2, "name": "Lin" }
  ]
}`,
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
        const combined = result.map((chunk) => chunk.content).join('\n')
        expect(combined).toContain('"users"')
        expect(combined).toContain('"Ada"')
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('context header', () => {
    it.effect('includes file path in context header', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/config.json',
          content: '{"a":1}',
          language: 'json',
        })

        expect(result.length).toBe(1)
        const header = extractContextHeader(result[0]!.content)
        expect(header).toContain('# filePath: /test/config.json')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('injects scope header for nested keys', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/scope.json',
          content: `{
  "root": {
    "child": {
      "leaf": true
    }
  }
}`,
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
        const header = extractContextHeader(result[0]!.content)
        expect(header).toContain('# filePath: /test/scope.json')
        expect(header).toContain('# scope:')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect(
      'does not duplicate adjacent scope segments for nested keys',
      () =>
        Effect.gen(function* () {
          const chunker = yield* Chunker
          const result = yield* chunker.chunk({
            filePath: '/test/no-dup-scope.json',
            content: `{
  "a": {
    "b": {
      "c": {
        "d": true
      },
      "e": 1
    },
    "f": 2
  }
}`,
            language: 'json',
          })

          expect(result.length).toBeGreaterThan(0)
          for (const chunk of result) {
            const header = extractContextHeader(chunk.content)
            expect(/\ba\s*->\s*a\b/.test(header)).toBe(false)
            expect(/\bb\s*->\s*b\b/.test(header)).toBe(false)
            expect(/\bc\s*->\s*c\b/.test(header)).toBe(false)
          }
        }).pipe(Effect.provide(TestLiveTinyChunks)),
    )

    it.effect('generates deterministic ids', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const content = '{"x":1,"y":2}'

        const result1 = yield* chunker.chunk({
          filePath: '/test/deterministic.json',
          content,
          language: 'json',
        })
        const result2 = yield* chunker.chunk({
          filePath: '/test/deterministic.json',
          content,
          language: 'json',
        })

        expect(result1[0]!.id).toBe(result2[0]!.id)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('chunk merging behavior', () => {
    it.effect('merges small pairs within target size', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/small-pairs.json',
          content: `{
  "a": 1,
  "b": 2,
  "c": 3,
  "d": 4
}`,
          language: 'json',
        })

        expect(result.length).toBeLessThanOrEqual(2)
      }).pipe(Effect.provide(TestLiveLargeChunks)),
    )

    it.effect('keeps large pairs separate', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const longValue = 'x'.repeat(280)
        const result = yield* chunker.chunk({
          filePath: '/test/large-pairs.json',
          content: `{
  "first": "${longValue}",
  "second": "${longValue}"
}`,
          language: 'json',
        })

        expect(result.length).toBeGreaterThanOrEqual(2)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('line tracking', () => {
    it.effect('tracks start and end lines correctly', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/lines.json',
          content: `{
  "name": "grepai",
  "nested": {
    "enabled": true
  }
}`,
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.startLine).toBe(0)
        expect(result[0]!.endLine).toBeGreaterThanOrEqual(result[0]!.startLine)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('returns 0-based line numbers', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/zero-based.json',
          content: '{\n  "a": 1\n}',
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.startLine).toBe(0)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('returns chunks in non-decreasing line order', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/order.json',
          content: `{
  "a": { "v": 1 },
  "b": { "v": 2 },
  "c": { "v": 3 }
}`,
          language: 'json',
        })

        for (let i = 1; i < result.length; i++) {
          expect(result[i]!.startLine).toBeGreaterThanOrEqual(
            result[i - 1]!.startLine,
          )
        }
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )
  })

  describe('edge cases', () => {
    it.effect('handles empty JSON object', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/empty-object.json',
          content: '{}',
          language: 'json',
        })

        expect(result).toEqual([])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles empty JSON array', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/empty-array.json',
          content: '[]',
          language: 'json',
        })

        expect(result).toEqual([])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles empty file', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/empty.json',
          content: '',
          language: 'json',
        })

        expect(result).toEqual([])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles JSON with only primitive value', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/primitive.json',
          content: '42',
          language: 'json',
        })

        expect(result).toEqual([])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles deeply nested objects', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/deep.json',
          content: `{
  "a": {
    "b": {
      "c": {
        "d": {
          "e": true
        }
      }
    }
  }
}`,
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
        const combined = result.map((chunk) => chunk.content).join('\n')
        expect(combined).toContain('"e"')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles JSON with special characters in keys', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/special-keys.json',
          content: `{
  "kebab-case": true,
  "snake_case": true,
  "space key": true,
  "emoji_😀": true
}`,
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('"kebab-case"')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles large arrays of objects', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const entries = Array.from(
          { length: 20 },
          (_, i) => `{"id":${i},"name":"user-${i}"}`,
        ).join(',')

        const result = yield* chunker.chunk({
          filePath: '/test/large-array.json',
          content: `{"users":[${entries}]}`,
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('closing syntax handling', () => {
    it.effect('does not emit chunks that only contain closing syntax', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/closing-syntax.json',
          content: `{
  "wrapped": {
    "ok": true
  }
}`,
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasClosingOnlyChunk = result.some((chunk) => {
          const body = chunk.content.split('---\n')[1] ?? ''
          return /^[\s)\]}>]+$/.test(body)
        })
        expect(hasClosingOnlyChunk).toBe(false)
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )

    it.effect('does not start split chunks with commas', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/comma-split.json',
          content: `{
  "a": {
    "nested": {
      "deep": true
    }
  },
  "b": {
    "nested": {
      "deep": true
    }
  },
  "c": {
    "nested": {
      "deep": true
    }
  }
}`,
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(1)
        const hasCommaPrefixedBody = result.some((chunk, index) => {
          if (index === 0) return false
          const body = (chunk.content.split('---\n')[1] ?? '').trimStart()
          return body.startsWith(',')
        })

        expect(hasCommaPrefixedBody).toBe(false)
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )
  })

  describe('realistic JSON files', () => {
    it.effect('handles package.json-like structure', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/package.json',
          content: `{
  "name": "grepai",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "bun run build",
    "test": "vitest"
  },
  "dependencies": {
    "effect": "^3.0.0",
    "typescript": "^5.0.0"
  }
}`,
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
        const combined = result.map((chunk) => chunk.content).join('\n')
        expect(combined).toContain('"dependencies"')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles tsconfig.json-like structure', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/tsconfig.json',
          content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "strict": true,
    "moduleResolution": "bundler",
    "paths": {
      "@core/*": ["packages/core/src/*"]
    }
  },
  "include": ["packages/**/*"],
  "exclude": ["node_modules", "dist"]
}`,
          language: 'json',
        })

        expect(result.length).toBeGreaterThan(0)
        const combined = result.map((chunk) => chunk.content).join('\n')
        expect(combined).toContain('"compilerOptions"')
      }).pipe(Effect.provide(TestLive)),
    )
  })
})
