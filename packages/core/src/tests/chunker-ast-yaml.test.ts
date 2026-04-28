import { describe, expect, it } from '@effect/vitest'
import * as Effect from 'effect/Effect'

import { Chunker } from '../domain/chunker'
import { extractContextHeader, makeChunkerAstTestLayer } from './test-harness'

const TestLive = makeChunkerAstTestLayer()
const TestLiveTinyChunks = makeChunkerAstTestLayer({
  targetChunkSize: 20,
  maxChunkSize: 40,
})

describe('ChunkerAst YAML Support', () => {
  it.effect('chunks block mapping pairs', () =>
    Effect.gen(function* () {
      const chunker = yield* Chunker
      const result = yield* chunker.chunk({
        filePath: '/test/config.yaml',
        content: `name: grepai
version: 1
features:
  java: true
  yaml: true`,
        language: 'yaml',
      })

      expect(result.length).toBeGreaterThan(0)
      const combined = result.map((chunk) => chunk.content).join('\n')
      expect(combined).toContain('name: grepai')
      expect(combined).toContain('features:')
    }).pipe(Effect.provide(TestLive)),
  )

  it.effect('chunks sequence items', () =>
    Effect.gen(function* () {
      const chunker = yield* Chunker
      const result = yield* chunker.chunk({
        filePath: '/test/workflow.yml',
        content: `steps:
  - name: install
    run: bun install
  - name: test
    run: bun test`,
        language: 'yaml',
      })

      expect(result.length).toBeGreaterThan(0)
      const combined = result.map((chunk) => chunk.content).join('\n')
      expect(combined).toContain('name: install')
      expect(combined).toContain('run: bun test')
    }).pipe(Effect.provide(TestLive)),
  )

  it.effect('adds YAML keys to context headers', () =>
    Effect.gen(function* () {
      const chunker = yield* Chunker
      const result = yield* chunker.chunk({
        filePath: '/test/service.yaml',
        content: `service:
  name: api
  port: 3000
database:
  host: localhost
  port: 5432`,
        language: 'yaml',
      })

      expect(result.length).toBeGreaterThan(0)
      const header = extractContextHeader(result[0]!.content)
      expect(header).toContain('# filePath: /test/service.yaml')
      expect(header).toContain('service')
    }).pipe(Effect.provide(TestLiveTinyChunks)),
  )
})
