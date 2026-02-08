import { FetchHttpClient } from '@effect/platform'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'

import { ChunkStorage } from '../../domain/chunk-storage'
import { Config } from '../../domain/config'

import { ChunkStorageSql } from './chunk-storage-sql'
import { ChunkerAst } from './chunker-ast'
import { CodebaseScannerFs } from './codebase-scanner-fs'
import { ConfigJson } from './config-json'
import { DocumentStorageSql } from './document-storage-sql'
import { EmbedderGemini } from './embedder-gemini'
import { Indexer } from './indexer'
import { LibsqlLive } from './sql'
import { TokenCounterGemini } from './token-counter-gemini'
import { VercelAi } from './vercel-ai'

const GrepAiLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* Config

    const EmbedderLive = Match.value(config.embedding.provider).pipe(
      Match.when('google', () => EmbedderGemini),
      Match.exhaustive,
    )
    const TokenCounterLive = Match.value(config.embedding.provider).pipe(
      Match.when('google', () => TokenCounterGemini),
      Match.exhaustive,
    )
    const StorageLive = Match.value(config.storage.type).pipe(
      Match.when('turso', () => LibsqlLive),
      Match.exhaustive,
    )
    const DocumentStorageLive = Match.value(config.storage.type).pipe(
      Match.when('turso', () => DocumentStorageSql),
      Match.exhaustive,
    )
    const ChunkStorageLive = Match.value(config.storage.type).pipe(
      Match.when('turso', () => ChunkStorageSql),
      Match.exhaustive,
    )

    return Indexer.Default.pipe(
      Layer.provideMerge(ChunkStorageLive),
      Layer.provide(CodebaseScannerFs),
      Layer.provide(ChunkerAst),
      Layer.provide(
        TokenCounterLive.pipe(Layer.provide(FetchHttpClient.layer)),
      ),
      Layer.provide(EmbedderLive.pipe(Layer.provide(VercelAi.Default))),
      Layer.provide(DocumentStorageLive),
      Layer.provideMerge(StorageLive),
    )
  }),
).pipe(Layer.provideMerge(ConfigJson))

export class GrepAi extends Effect.Service<GrepAi>()(
  '@grepai/core/internal/services/grep-ai/GrepAi',
  {
    dependencies: [GrepAiLive],
    effect: Effect.gen(function* () {
      const config = yield* Config
      const indexer = yield* Indexer
      const chunkStorage = yield* ChunkStorage

      return {
        search: chunkStorage.search,
        index: indexer.index,
        config,
      } as const
    }),
  },
) {}
