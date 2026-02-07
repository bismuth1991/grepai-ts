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
    embeddingBatchSize: 10,
    dimensions: 3072,
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
    embeddingBatchSize: 10,
    dimensions: 3072,
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
)

const TestLiveLargeChunks = ChunkerAst.pipe(
  Layer.provide(AstParser.Default),
  Layer.provide(ContextHeaderBuilder.Default),
  Layer.provide(TokenCounterTest),
  Layer.provide(LargeChunkConfigTest),
)

const TinyChunkConfigTest = Layer.succeed(Config, {
  cwd: '/test',
  embedding: {
    provider: 'google',
    model: 'gemini-embedding-001',
    apiKey: 'test-key',
    targetChunkSize: 20,
    maxChunkSize: 40,
    embeddingBatchSize: 10,
    dimensions: 3072,
  },
  include: [],
  exclude: [],
  storage: {
    type: 'turso',
    url: 'test',
    authToken: 'test',
  },
})

const TestLiveTinyChunks = ChunkerAst.pipe(
  Layer.provide(AstParser.Default),
  Layer.provide(ContextHeaderBuilder.Default),
  Layer.provide(TokenCounterTest),
  Layer.provide(TinyChunkConfigTest),
)

describe('ChunkerAst', () => {
  describe('basic chunking', () => {
    it.effect('chunks a simple function declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: 'function hello() { return "world" }',
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]).toHaveProperty('hash')
        expect(result[0]).toHaveProperty('content')
        expect(result[0]).toHaveProperty('startLine')
        expect(result[0]).toHaveProperty('endLine')
        expect(result[0]).toHaveProperty('scope')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks a class declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: `class MyClass {
  constructor() {}
  method() { return 1 }
}`,
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasClassScope = result.some((chunk) =>
          chunk.scope.some((s) => s.includes('MyClass')),
        )
        expect(hasClassScope).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks an interface declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: `interface User {
  name: string
  age: number
}`,
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasInterfaceScope = result.some((chunk) =>
          chunk.scope.some((s) => s.includes('User')),
        )
        expect(hasInterfaceScope).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks a type alias', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: 'type Callback = (x: string) => void',
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks an enum declaration', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: `enum Status {
  Active,
  Inactive,
  Pending
}`,
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasEnumScope = result.some((chunk) =>
          chunk.scope.some((s) => s.includes('Status')),
        )
        expect(hasEnumScope).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('import handling', () => {
    it.effect('chunks import statements without scope', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: `import { foo } from './foo'
import { bar } from './bar'`,
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
        const allImportsHaveEmptyScope = result.every(
          (chunk) => chunk.scope.length === 0,
        )
        expect(allImportsHaveEmptyScope).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('chunks export statements without scope', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: `export { foo } from './foo'
export default function() {}`,
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('scope tracking', () => {
    it.effect('tracks class scope when content fits in one chunk', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: `class Outer {
  inner() {
    function nested() {
      return 1
    }
  }
}`,
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasOuterScope = result.some((chunk) =>
          chunk.scope.some((s) => s.includes('Outer')),
        )
        expect(hasOuterScope).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('tracks nested scope when content forces chunking', () =>
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
          filePath: '/test/file.ts',
          content: nestedContent,
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasOuterScope = result.some((chunk) =>
          chunk.scope.some((s) => s.includes('Outer')),
        )
        expect(hasOuterScope).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('tracks arrow function scope via variable name', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: 'const myArrow = () => { return 42 }',
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasArrowScope = result.some((chunk) =>
          chunk.scope.some((s) => s.includes('myArrow')),
        )
        expect(hasArrowScope).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('content and context header', () => {
    it.effect('includes file path in context header', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/my-file.ts',
          content: 'function foo() {}',
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
        expect(result[0]!.content).toContain('/test/my-file.ts')
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('includes scope in context header when present', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: `class MyClass {
  myMethod() {
    return 1
  }
}`,
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasMethodScope = result.some(
          (chunk) =>
            chunk.content.includes('MyClass') &&
            chunk.content.includes('myMethod'),
        )
        expect(hasMethodScope).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('generates unique hashes for different content', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result1 = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: 'function a() { return 1 }',
          language: 'typescript',
        })
        const result2 = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: 'function b() { return 2 }',
          language: 'typescript',
        })

        expect(result1[0]!.hash).not.toBe(result2[0]!.hash)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('generates stable hashes for identical input', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const content = 'function stable() { return 1 }'

        const result1 = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content,
          language: 'typescript',
        })
        const result2 = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content,
          language: 'typescript',
        })

        expect(result1).toHaveLength(1)
        expect(result2).toHaveLength(1)
        expect(result1[0]!.hash).toBe(result2[0]!.hash)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('changes hash when only file path changes', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const content = 'function sameContent() { return 1 }'

        const result1 = yield* chunker.chunk({
          filePath: '/test/a.ts',
          content,
          language: 'typescript',
        })
        const result2 = yield* chunker.chunk({
          filePath: '/test/b.ts',
          content,
          language: 'typescript',
        })

        expect(result1).toHaveLength(1)
        expect(result2).toHaveLength(1)
        expect(result1[0]!.hash).not.toBe(result2[0]!.hash)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('chunk merging behavior', () => {
    it.effect('merges small chunks within target size', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: `const a = 1
const b = 2
const c = 3`,
          language: 'typescript',
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
          filePath: '/test/file.ts',
          content:
            longFunction + '\n' + longFunction.replace('veryLong', 'another'),
          language: 'typescript',
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
          filePath: '/test/file.ts',
          content: `function first() {}

function second() {}

function third() {}`,
          language: 'typescript',
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
          filePath: '/test/file.ts',
          content: 'const x = 1',
          language: 'typescript',
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
          filePath: '/test/ordered.ts',
          content: `function first() {
  return 1
}

function second() {
  return 2
}

function third() {
  return 3
}`,
          language: 'typescript',
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

  describe('scope and merge invariants', () => {
    it.effect('deduplicates repeated scope paths within a merged chunk', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/dedupe.ts',
          content: `class Service {
  run() {
    const alpha = 'a'
    const beta = 'b'
    const gamma = 'c'
    return alpha + beta + gamma
  }
}`,
          language: 'typescript',
        })

        const chunkWithScope = result.find((chunk) => chunk.scope.length > 0)
        expect(chunkWithScope).toBeDefined()
        if (chunkWithScope) {
          const serialized = chunkWithScope.scope.map((s) => s.join(' -> '))
          expect(new Set(serialized).size).toBe(serialized.length)
        }
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )

    it.effect('does not treat import bindings as scope names', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/import-and-code.ts',
          content: `import { dep } from './dep'

function execute() {
  return dep
}`,
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)

        const allScopeNames = result
          .flatMap((chunk) => chunk.scope)
          .flatMap((scopePath) => scopePath)
        expect(allScopeNames.includes('dep')).toBe(false)
        expect(allScopeNames.includes('execute')).toBe(true)
      }).pipe(Effect.provide(TestLiveTinyChunks)),
    )

    it.effect('does not emit chunks that only contain closing syntax', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/closing-syntax.ts',
          content: `function wrapped() {
  if (true) {
    return {
      ok: true,
    }
  }
}`,
          language: 'typescript',
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
    it.effect('handles abstract classes', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: `abstract class Base {
  abstract method(): void
}`,
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasBaseScope = result.some((chunk) =>
          chunk.scope.some((s) => s.includes('Base')),
        )
        expect(hasBaseScope).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles generator functions', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: `function* generator() {
  yield 1
  yield 2
}`,
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasGeneratorScope = result.some((chunk) =>
          chunk.scope.some((s) => s.includes('generator')),
        )
        expect(hasGeneratorScope).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles namespaces/modules', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: `namespace MyNamespace {
  export function foo() {}
}`,
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles mixed content', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/file.ts',
          content: `import { x } from './x'

interface User {
  name: string
}

class UserService {
  getUser(): User {
    return { name: 'test' }
  }
}

export const service = new UserService()`,
          language: 'typescript',
        })

        expect(result.length).toBeGreaterThan(0)
        const hasUserScope = result.some((chunk) =>
          chunk.scope.some((s) => s.includes('User')),
        )
        const hasUserServiceScope = result.some((chunk) =>
          chunk.scope.some((s) => s.includes('UserService')),
        )
        expect(hasUserScope || hasUserServiceScope).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )
  })

  describe('edge cases', () => {
    it.effect('handles empty file', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/empty.ts',
          content: '',
          language: 'typescript',
        })

        expect(result).toEqual([])
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles file with only comments', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/comments.ts',
          content: `// This is a comment
/* This is a block comment */`,
          language: 'typescript',
        })

        expect(Array.isArray(result)).toBe(true)
      }).pipe(Effect.provide(TestLive)),
    )

    it.effect('handles single-line content', () =>
      Effect.gen(function* () {
        const chunker = yield* Chunker
        const result = yield* chunker.chunk({
          filePath: '/test/single.ts',
          content: 'type X = string',
          language: 'typescript',
        })

        expect(result.length).toBe(1)
        expect(result[0]!.startLine).toBe(0)
        expect(result[0]!.endLine).toBe(0)
      }).pipe(Effect.provide(TestLive)),
    )
  })
})
