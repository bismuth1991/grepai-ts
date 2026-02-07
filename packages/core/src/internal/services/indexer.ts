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
import { DocumentStorage } from '../../domain/document-storage'
import { Embedder } from '../../domain/embedder'
import { IndexerCallbackError, IndexerError } from '../../domain/errors'

const voidFn = () => Effect.void

export class Indexer extends Effect.Service<Indexer>()(
  '@grepai/core/internal/services/indexer',
  {
    effect: Effect.gen(function* () {
      const CHUNK_BATCH_SIZE = 100

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
            Effect.forEach(filesToDelete, chunkStorage.removeByFilePath),
            Effect.zipRight(
              Effect.forEach(filesToDelete, documentStorage.removeByFilePath),
            ),
          )

          const filesToProcess = Array.appendAll(newFiles, modified)

          const chunkBatches = yield* Effect.forEach(
            filesToProcess,
            ({ filePath, language, content, hash: fileHash }) =>
              pipe(
                chunker.chunk({ filePath, content, language }),
                Effect.tap(() =>
                  onFileChunked({
                    filePath,
                    fileCount: filesToProcess.length,
                  }),
                ),
                Effect.map(
                  Array.map((chunk, index) => ({
                    ...chunk,
                    fileHash,
                    chunkId: `${filePath}__${index}`,
                  })),
                ),
              ),
          ).pipe(
            Effect.map(Array.flatten),
            Effect.map(Array.chunksOf(CHUNK_BATCH_SIZE)),
          )

          yield* Effect.forEach(chunkBatches, (chunks) =>
            Effect.gen(function* () {
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
                chunks,
                ({ filePath, fileHash }) => ({
                  filePath,
                  hash: fileHash,
                }),
              )
              yield* pipe(
                Effect.forEach(documentsToInsert, documentStorage.insert),
                Effect.zipRight(chunkStorage.insertMany(chunksToInsert)),
                db.withTransaction,
              )
            }).pipe(Effect.tap(() => onChunkBatchProcessed(chunks.length))),
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
