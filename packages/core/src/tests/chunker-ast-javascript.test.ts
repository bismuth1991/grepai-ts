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

const ConfigTest = Layer.succeed(Config, {
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

const LargeChunkConfigTest = Layer.succeed(Config, {
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

const TinyChunkConfigTest = Layer.succeed(Config, {
  cwd: '/test',
  embedding: {
    provider: 'google',
    model: 'gemini-embedding-001',
    apiKey: 'test-key',
    targetChunkSize: 20,
    maxChunkSize: 40,
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
  Layer.provide(ConfigTest),
  Layer.provideMerge(BunContext.layer),
)

const TestLiveLargeChunks = ChunkerAst.pipe(
  Layer.provide(AstParser.Default),
  Layer.provide(ContextHeaderBuilder.Default),
  Layer.provide(TokenCounterTest),
  Layer.provide(LargeChunkConfigTest),
  Layer.provideMerge(BunContext.layer),
)

const TestLiveTinyChunks = ChunkerAst.pipe(
  Layer.provide(AstParser.Default),
  Layer.provide(ContextHeaderBuilder.Default),
  Layer.provide(TokenCounterTest),
  Layer.provide(TinyChunkConfigTest),
  Layer.provideMerge(BunContext.layer),
)

function extractContextHeader(content: string) {
  const [header = ''] = content.split('\n---\n')
  return header
}

describe('ChunkerAst JavaScript Support', () => {
  describe('basic chunking', () => {
    it.effect('chunks a simple function declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.mjs',
          content: 'function hello() { return "world" }',
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]).toHaveProperty('id')
        expect(result[0]).toHaveProperty('content')
        expect(result[0]).toHaveProperty('startLine')
        expect(result[0]).toHaveProperty('endLine')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks a class declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.cjs',
          content: `class MyClass {
  constructor() {}
  method() { return 1 }
}`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasClassContent = result.some((chunk) =>
          chunk.content.includes('class MyClass'),
        )
        expect(hasClassContent).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks a variable declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.js',
          content: 'const x = 42',
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('const x = 42')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks a generator function', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.mjs',
          content: `function* generator() {
  yield 1
  yield 2
}`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasGeneratorFunction = result.some((chunk) =>
          chunk.content.includes('function* generator()'),
        )
        expect(hasGeneratorFunction).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('import handling', () => {
    it.effect('chunks ESM import statements', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.mjs',
          content: `import { foo } from './foo.mjs'
import { bar } from './bar.mjs'`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        const allChunksContainImport = result.every((chunk) =>
          chunk.content.includes('import'),
        )
        expect(allChunksContainImport).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks CJS require via variable declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.cjs',
          content: `const fs = require('fs')
const path = require('path')`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        const combined = result.map((chunk) => chunk.content).join('\n')
        expect(combined).toContain("require('fs')")
        expect(combined).toContain("require('path')")
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks export statements', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.mjs',
          content: `export { foo } from './foo.mjs'
export default function() {}`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('structure tracking', () => {
    it.effect('keeps class declaration when content fits in one chunk', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.js',
          content: `class Outer {
  inner() {
    function nested() {
      return 1
    }
  }
}`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasOuterDeclaration = result.some((chunk) =>
          chunk.content.includes('class Outer'),
        )
        expect(hasOuterDeclaration).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('keeps nested declarations when content forces chunking', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const nestedContent = `class Outer {
  inner() {
    function nested() {
      const longVar1 = "this string is intentionally very long to force chunk splitting"
      const longVar2 = "another very long string that pushes us over the limit"
      const longVar3 = "and yet another string to really make sure we split"
      return longVar1 + longVar2 + longVar3
    }
  }
}`
        const result = yield* chunker.chunk({
          filePath: '/test/file.js',
          content: nestedContent,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasOuterDeclaration = result.some((chunk) =>
          chunk.content.includes('class Outer'),
        )
        expect(hasOuterDeclaration).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('keeps arrow function declaration via variable name', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.mjs',
          content: 'const myArrow = () => { return 42 }',
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasArrowDeclaration = result.some((chunk) =>
          chunk.content.includes('const myArrow = () =>'),
        )
        expect(hasArrowDeclaration).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('content and context header', () => {
    it.effect('includes file path in context header', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/my-file.mjs',
          content: 'function foo() {}',
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('/test/my-file.mjs')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('injects scope header lines when scope is present', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.js',
          content: `class MyClass {
  myMethod() {
    return 1
  }
}`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        const chunkWithMethod = result.find((chunk) =>
          chunk.content.includes('myMethod'),
        )
        expect(chunkWithMethod).toBeDefined()
        if (!chunkWithMethod) return

        const header = extractContextHeader(chunkWithMethod.content)
        expect(header).toContain('# filePath: /test/file.js')
        expect(header).toContain('# scope:')
        expect(header).toContain('#   - MyClass')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('generates deterministic ids from file path and index', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result1 = yield* chunker.chunk({
          filePath: '/test/file.js',
          content: 'function a() { return 1 }',
          language: 'javascript',
        })
        const result2 = yield* chunker.chunk({
          filePath: '/test/file.js',
          content: 'function b() { return 2 }',
          language: 'javascript',
        })

        expect(result1[0]!.id).toBe('/test/file.js__0')
        expect(result2[0]!.id).toBe('/test/file.js__0')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('generates stable ids for identical input', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const content = 'function stable() { return 1 }'

        const result1 = yield* chunker.chunk({
          filePath: '/test/file.mjs',
          content,
          language: 'javascript',
        })
        const result2 = yield* chunker.chunk({
          filePath: '/test/file.mjs',
          content,
          language: 'javascript',
        })

        expect(result1).toHaveLength(1)
        expect(result2).toHaveLength(1)
        expect(result1[0]!.id).toBe(result2[0]!.id)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('changes id when only file path changes', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const content = 'function sameContent() { return 1 }'

        const result1 = yield* chunker.chunk({
          filePath: '/test/a.mjs',
          content,
          language: 'javascript',
        })
        const result2 = yield* chunker.chunk({
          filePath: '/test/b.cjs',
          content,
          language: 'javascript',
        })

        expect(result1).toHaveLength(1)
        expect(result2).toHaveLength(1)
        expect(result1[0]!.id).not.toBe(result2[0]!.id)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('chunk merging behavior', () => {
    it.effect('merges small chunks within target size', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.js',
          content: `const a = 1
const b = 2
const c = 3`,
          language: 'javascript',
        })

        expect(result.length).toBeLessThanOrEqual(3)
      }).pipe(Effect.provide(TestLiveLargeChunks)),
    )

    it.effect('keeps chunks separate when they exceed target size', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const longFunction = `function veryLongFunctionName() {
  const x = "this is a very long string that should push the token count over the limit"
  return x
}`
        const result = yield* chunker.chunk({
          filePath: '/test/file.mjs',
          content:
            longFunction + '\n' + longFunction.replace('veryLong', 'another'),
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('line tracking', () => {
    it.effect('tracks start and end lines correctly', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.js',
          content: `function first() {}

function second() {}

function third() {}`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        for (const chunk of result) {
          expect(chunk.startLine).toBeGreaterThanOrEqual(0)
          expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine)
        }
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('returns 0-based line numbers', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.cjs',
          content: 'const x = 1',
          language: 'javascript',
        })

        expect(result.length).toBe(1)
        expect(result[0]!.startLine).toBe(0)
        expect(result[0]!.endLine).toBe(0)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('returns chunks in non-decreasing line order', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/ordered.mjs',
          content: `function first() {
  return 1
}

function second() {
  return 2
}

function third() {
  return 3
}`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        for (let i = 1; i < result.length; i++) {
          expect(result[i]!.startLine).toBeGreaterThanOrEqual(
            result[i - 1]!.startLine,
          )
        }
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )
  })

  describe('merge invariants', () => {
    it.effect(
      'retains class and method declarations within merged chunks',
      () =>
        Effect.gen(function* () {
          const chunker = yield* Chunker
          const result = yield* chunker.chunk({
            filePath: '/test/dedupe.js',
            content: `class Service {
  run() {
    const alpha = 'a'
    const beta = 'b'
    const gamma = 'c'
    return alpha + beta + gamma
  }
}`,
            language: 'javascript',
          })

          const mergedChunk = result.find((chunk) =>
            chunk.content.includes('class Service'),
          )
          expect(mergedChunk).toBeDefined()
          expect(mergedChunk?.content.includes('run()')).toBe(true)
        }).pipe(Effect.provide(TestLiveTinyChunks)),
    )

    it.effect('does not drop import bindings and function declarations', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/import-and-code.mjs',
          content: `import { dep } from './dep.mjs'

function execute() {
  return dep
}`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)

        const combinedContent = result.map((chunk) => chunk.content).join('\n')
        expect(
          combinedContent.includes("import { dep } from './dep.mjs'"),
        ).toBe(true)
        expect(combinedContent.includes('function execute()')).toBe(true)
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )

    it.effect('does not emit chunks that only contain closing syntax', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/closing-syntax.js',
          content: `function wrapped() {
  if (true) {
    return {
      ok: true,
    }
  }
}`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasClosingOnlyChunk = result.some((chunk) => {
          const body = chunk.content.split('---\n')[1] ?? ''
          return /^[\s)\]}>]+$/.test(body)
        })
        expect(hasClosingOnlyChunk).toBe(false)
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )
  })

  describe('complex code structures', () => {
    it.effect('handles class with static block', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.js',
          content: `class Config {
  static {
    Config.instance = new Config()
  }
}`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasClass = result.some((chunk) =>
          chunk.content.includes('class Config'),
        )
        expect(hasClass).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles async functions', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.mjs',
          content: `async function fetchData() {
  const response = await fetch('/api')
  return response.json()
}`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasAsyncFunction = result.some((chunk) =>
          chunk.content.includes('async function fetchData()'),
        )
        expect(hasAsyncFunction).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles mixed content', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.mjs',
          content: `import { dep } from './dep.mjs'

class UserService {
  getUser() {
    return { name: 'test' }
  }
}

export const service = new UserService()`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasUserServiceDeclaration = result.some((chunk) =>
          chunk.content.includes('class UserService'),
        )
        expect(hasUserServiceDeclaration).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles IIFE patterns', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.cjs',
          content: `const module = (function() {
  const private_val = 42
  return { get: () => private_val }
})()`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles destructuring assignments', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.mjs',
          content: `const { a, b, c } = someObject
const [x, y, z] = someArray`,
          language: 'javascript',
        })

        expect(result.length).toBeGreaterThan(0)
        const combined = result.map((chunk) => chunk.content).join('\n')
        expect(combined).toContain('someObject')
        expect(combined).toContain('someArray')
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('edge cases', () => {
    it.effect('handles empty file', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/empty.js',
          content: '',
          language: 'javascript',
        })

        expect(result).toEqual([])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles file with only comments', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/comments.js',
          content: `// This is a comment
/* This is a block comment */`,
          language: 'javascript',
        })

        expect(Array.isArray(result)).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles single-line content', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/single.cjs',
          content: 'const x = "hello"',
          language: 'javascript',
        })

        expect(result.length).toBe(1)
        expect(result[0]!.startLine).toBe(0)
        expect(result[0]!.endLine).toBe(0)
      }).pipe(Effect.provide(TestLive)),
    )
  })
})
