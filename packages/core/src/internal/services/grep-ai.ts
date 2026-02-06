import { FetchHttpClient } from '@effect/platform'
import { SqlClient } from '@effect/sql'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'

import { Config } from '../../domain/config'
import { Embedder } from '../../domain/embedder'

import { ChunkStorageSql } from './chunk-storage-sql'
import { ChunkerAst } from './chunker-ast'
import { CodebaseScannerFs } from './codebase-scanner-fs'
import { ConfigJson } from './config-json'
import { DocumentStorageSql } from './document-storage-sql'
import { EmbedderGemini } from './embedder-gemini'
import { EmbeddingCacheSql } from './embedding-cache-sql'
import { Indexer } from './indexer'
import { LibsqlLive } from './sql'
import { TokenCounterCacheSql } from './token-counter-cache-sql'
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
    const EmbeddingCacheLive = Match.value(config.storage.type).pipe(
      Match.when('turso', () => EmbeddingCacheSql),
      Match.exhaustive,
    )
    const TokenCounterCacheLive = Match.value(config.storage.type).pipe(
      Match.when('turso', () => TokenCounterCacheSql),
      Match.exhaustive,
    )

    return Indexer.Default.pipe(
      Layer.provide(CodebaseScannerFs),
      Layer.provide(ChunkerAst),
      Layer.provide(ChunkStorageLive),
      Layer.provide(
        TokenCounterLive.pipe(Layer.provide(TokenCounterCacheLive)),
      ),
      Layer.provideMerge(
        EmbedderLive.pipe(
          Layer.provide(VercelAi.Default),
          Layer.provide(EmbeddingCacheLive),
        ),
      ),
      Layer.provideMerge(DocumentStorageLive),
      Layer.provideMerge(FetchHttpClient.layer),
      Layer.provideMerge(StorageLive),
    )
  }),
).pipe(Layer.provideMerge(ConfigJson))

export class GrepAi extends Effect.Service<GrepAi>()(
  '@grepai/core/internal/services/grep-ai/GrepAi',
  {
    dependencies: [GrepAiLive],
    effect: Effect.gen(function* () {
      const embedder = yield* Embedder
      const db = yield* SqlClient.SqlClient
      const indexer = yield* Indexer

      const search = Effect.fnUntraced(function* (input: {
        query: string
        topK: number
      }) {
        const { query, topK } = input

        const queryEmbedding = yield* embedder.embedQuery(query)

        return yield* db.onDialectOrElse({
          orElse: () => db`
            SELECT
              c.file_path
              , c.start_line
              , c.end_line
            FROM
              vector_top_k(
                'idx_chunks_vector'
                , vector32(${queryEmbedding})
                , ${topK}
              ) v
            INNER JOIN
              chunks c ON c.id = v.id
          `,
        })
      })

      return {
        search,
        index: indexer.index,
      } as const
    }),
  },
) {}
