import { SqlClient } from '@effect/sql'
import { pipe } from 'effect'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'

import { ChunkStorage } from '../../domain/chunk-storage'
import { Chunker } from '../../domain/chunker'
import {
  CodebaseScanner,
  CodebaseScanResult,
} from '../../domain/codebase-scanner'
import { Config } from '../../domain/config'
import { DocumentStorage } from '../../domain/document-storage'
import { Embedder } from '../../domain/embedder'
import { IndexerCallbackError, IndexerError } from '../../domain/errors'

const voidFn = () => Effect.void

export class Indexer extends Effect.Service<Indexer>()(
  '@grepai/core/internal/services/indexer',
  {
    effect: Effect.gen(function* () {
      const config = yield* Config
      const db = yield* SqlClient.SqlClient
      const codebaseScanner = yield* CodebaseScanner
      const chunker = yield* Chunker
      const embedder = yield* Embedder
      const chunkStorage = yield* ChunkStorage
      const documentStorage = yield* DocumentStorage

      const index = Effect.fnUntraced(
        function* (callbacks?: {
          onCodebaseIndexStarted?: () => Effect.Effect<
            void,
            IndexerCallbackError
          >
          onCodebaseScanned?: (
            result: CodebaseScanResult,
          ) => Effect.Effect<void, IndexerCallbackError>
          onFileChunked?: (input: {
            filePath: string
            fileCount: number
          }) => Effect.Effect<void, IndexerCallbackError>
          onChunkBatchProcessed?: (
            chunkCount: number,
          ) => Effect.Effect<void, IndexerCallbackError>
          onCodebaseIndexFinished?: () => Effect.Effect<
            void,
            IndexerCallbackError
          >
        }) {
          const {
            onCodebaseIndexStarted = voidFn,
            onCodebaseScanned = voidFn,
            onFileChunked = voidFn,
            onChunkBatchProcessed = voidFn,
            onCodebaseIndexFinished = voidFn,
          } = callbacks ?? {}

          yield* onCodebaseIndexStarted()

          const {
            new: newFiles,
            modified,
            unchanged: _, // Currently we don't do anything with unchanged files
            deleted,
          } = yield* codebaseScanner.scan().pipe(
            Effect.tap(onCodebaseScanned), //
          )

          const filesToDelete = Array.map(
            Array.appendAll(modified, deleted),
            ({ filePath }) => filePath,
          )

          yield* pipe(
            Effect.forEach(filesToDelete, chunkStorage.removeByFilePath, {
              concurrency: 'unbounded',
            }),
            Effect.zipRight(
              Effect.forEach(filesToDelete, documentStorage.removeByFilePath, {
                concurrency: 'unbounded',
              }),
            ),
            db.withTransaction,
          )

          const filesToProcess = Array.appendAll(newFiles, modified)

          yield* Effect.forEach(
            filesToProcess,
            ({ filePath, language, content, hash }) =>
              pipe(
                chunker.chunk({ filePath, content, language }),
                Effect.tap((chunks) =>
                  pipe(
                    documentStorage.insert({
                      filePath,
                      hash,
                    }),
                    Effect.zipRight(chunkStorage.insertMany(chunks)),
                    db.withTransaction,
                  ),
                ),
                Effect.tap(() =>
                  onFileChunked({
                    filePath,
                    fileCount: filesToProcess.length,
                  }),
                ),
              ),
            { concurrency: 500 },
          ).pipe(Effect.map(Array.flatten))

          const chunksToEmbed = yield* chunkStorage.getAllWithoutEmbedding()

          yield* Effect.forEach(
            Array.chunksOf(chunksToEmbed, config.embedding.embeddingBatchSize),
            (chunks) =>
              Effect.gen(function* () {
                const embeddings = yield* embedder.embedMany(
                  Array.map(chunks, ({ content }) => content),
                )
                const chunkEmbeddingToInsert = Array.map(
                  chunks,
                  (chunk, index) => ({
                    chunkId: chunk.id,
                    embedding: embeddings[index]!,
                  }),
                )
                yield* Effect.forEach(
                  chunkEmbeddingToInsert,
                  chunkStorage.insertEmbedding,
                  { concurrency: 'unbounded' },
                )
              }).pipe(
                Effect.tap(() => onChunkBatchProcessed(chunksToEmbed.length)),
              ),
            { concurrency: 10 },
          )

          yield* Effect.sleep(1000).pipe(
            Effect.zipRight(onCodebaseIndexFinished()),
          )
        },
        Effect.catchTags({
          SqlError: (cause) => new IndexerError({ cause }),
        }),
      )

      return {
        index,
      } as const
    }),
  },
) {}
