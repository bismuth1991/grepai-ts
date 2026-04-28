import { BunContext } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { Config, type GrepAiConfig } from '../domain/config'
import { TokenCounter } from '../domain/token-counter'
import { ChunkerAst } from '../internal/services/chunker-ast'
import { AstParser } from '../internal/services/chunker-ast/ast-parser'
import { ContextHeaderBuilder } from '../internal/services/chunker-ast/context-header-builder'

export const TokenCounterTest = Layer.succeed(TokenCounter, {
  count: (content: string) => Effect.succeed(Math.ceil(content.length / 4)),
})

export function makeTestConfig(
  options: {
    targetChunkSize?: number
    maxChunkSize?: number
  } = {},
): GrepAiConfig {
  const { targetChunkSize = 50, maxChunkSize = 100 } = options

  return {
    cwd: '/test',
    baseCwd: '/test',
    project: 'test',
    embedding: {
      provider: 'google',
      model: 'gemini-embedding-001',
      apiKey: 'test-key',
      targetChunkSize,
      maxChunkSize,
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
  }
}

export function makeConfigTestLayer(options?: Parameters<typeof makeTestConfig>[0]) {
  return Layer.succeed(Config, makeTestConfig(options))
}

export function makeChunkerAstTestLayer(
  options?: Parameters<typeof makeTestConfig>[0],
) {
  return ChunkerAst.pipe(
    Layer.provide(AstParser.Default),
    Layer.provide(ContextHeaderBuilder.Default),
    Layer.provide(TokenCounterTest),
    Layer.provide(makeConfigTestLayer(options)),
    Layer.provideMerge(BunContext.layer),
  )
}

export function extractContextHeader(content: string) {
  const [header = ''] = content.split('\n---\n')
  return header
}
