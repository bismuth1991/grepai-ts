import { FetchHttpClient } from '@effect/platform'
import { BunContext } from '@effect/platform-bun'
import { SqlClient } from '@effect/sql'
import { pipe } from 'effect'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'

import { ChunkStorage } from '../../domain/chunk-storage'
import { Chunker } from '../../domain/chunker'
import { CodebaseScanner } from '../../domain/codebase-scanner'
import { Config } from '../../domain/config'
import { DocumentStorage } from '../../domain/document-storage'
import { Embedder } from '../../domain/embedder'

import { ChunkStorageSql } from './chunk-storage-sql'
import { ChunkerAst } from './chunker-ast'
import { CodebaseScannerFs } from './codebase-scanner-fs'
import { ConfigJson } from './config-json'
import { DocumentStorageSql } from './document-storage-sql'
import { EmbedderGemini } from './embedder-gemini'
import { EmbeddingCacheSql } from './embedding-cache-sql'
import { LibsqlLive } from './sql'
import { TokenCounterCacheSql } from './token-counter-cache-sql'
import { TokenCounterGemini } from './token-counter-gemini'
import { VercelAi } from './vercel-ai'

const IndexerLive = Layer.unwrapEffect(
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

    return Layer.mergeAll(
      CodebaseScannerFs,
      ChunkerAst,
      EmbedderLive,
      ChunkStorageLive,
    ).pipe(
      Layer.provide(VercelAi.Default),
      Layer.provide(EmbeddingCacheLive),
      Layer.provide(
        TokenCounterLive.pipe(Layer.provide(TokenCounterCacheLive)),
      ),
      Layer.provideMerge(DocumentStorageLive),
      Layer.provideMerge(FetchHttpClient.layer),
      Layer.provideMerge(StorageLive),
    )
  }),
).pipe(Layer.provideMerge(ConfigJson), Layer.provideMerge(BunContext.layer))

export class Indexer extends Effect.Service<Indexer>()(
  '@grepai/core/internal/services/indexer',
  {
    dependencies: [IndexerLive],
    effect: Effect.gen(function* () {
      const db = yield* SqlClient.SqlClient
      const codebaseScanner = yield* CodebaseScanner
      const chunker = yield* Chunker
      const embedder = yield* Embedder
      const chunkStorage = yield* ChunkStorage
      const documentStorage = yield* DocumentStorage

      const index = Effect.fnUntraced(function* () {
        const {
          new: newFiles,
          modified,
          unchanged: _, // Currently we don't do anything with unchanged files
          deleted,
        } = yield* codebaseScanner.scan()

        const chunks = yield* Effect.forEach(
          Array.appendAll(newFiles, modified),
          ({ filePath, language, content }) =>
            pipe(
              chunker.chunk({ filePath, content, language }),
              Effect.map(
                Array.map((chunk, index) => ({
                  ...chunk,
                  chunkId: `${filePath}__${index}`,
                })),
              ),
            ),
        ).pipe(Effect.map(Array.flatten))

        if (!Array.isNonEmptyReadonlyArray(chunks)) {
          return
        }

        const embeddings = yield* embedder.embedMany(
          Array.map(chunks, ({ content }) => content),
        )

        const chunksToInsert = Array.map(
          chunks,
          ({ scope: _, ...chunk }, index) => ({
            ...chunk,
            embedding: embeddings[index]!,
          }),
        )
        const documentsToInsert = Array.map(
          Array.appendAll(newFiles, modified),
          ({ filePath, hash }) => ({
            filePath,
            hash,
          }),
        )
        const documentsToDelete = Array.map(deleted, ({ filePath }) => filePath)

        yield* pipe(
          chunkStorage.insertMany(chunksToInsert),
          Effect.zipRight(
            Effect.forEach(documentsToInsert, documentStorage.insert),
          ),
          Effect.zipRight(
            Effect.forEach(documentsToDelete, documentStorage.removeByFilePath),
          ),
          db.withTransaction,
        )
      })

      return {
        index,
      } as const
    }),
  },
) {}
