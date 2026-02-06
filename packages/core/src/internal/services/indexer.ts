import { SqlClient } from '@effect/sql'
import { pipe } from 'effect'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'

import { ChunkStorage } from '../../domain/chunk-storage'
import { Chunker } from '../../domain/chunker'
import { CodebaseScanner } from '../../domain/codebase-scanner'
import { DocumentStorage } from '../../domain/document-storage'
import { Embedder } from '../../domain/embedder'

export class Indexer extends Effect.Service<Indexer>()(
  '@grepai/core/internal/services/indexer',
  {
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
        const documentsToDelete = Array.map(
          Array.appendAll(modified, deleted),
          ({ filePath }) => filePath,
        )

        yield* pipe(
          Effect.forEach(documentsToDelete, chunkStorage.removeByFilePath),
          Effect.zipRight(
            Effect.forEach(documentsToDelete, documentStorage.removeByFilePath),
          ),
          Effect.zipRight(
            Effect.forEach(documentsToInsert, documentStorage.insert),
          ),
          Effect.zipRight(chunkStorage.insertMany(chunksToInsert)),
          db.withTransaction,
        )
      })

      return {
        index,
      } as const
    }),
  },
) {}
