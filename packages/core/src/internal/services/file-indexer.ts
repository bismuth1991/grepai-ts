import { SqlClient } from '@effect/sql'
import { pipe } from 'effect'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'

import { IndexerError, SupportedLanguage } from '../../domain'
import { ChunkStorage } from '../../domain/chunk-storage'
import { Chunker } from '../../domain/chunker'
import { DocumentStorage } from '../../domain/document-storage'
import { Embedder } from '../../domain/embedder'

export class FileIndexer extends Effect.Service<FileIndexer>()(
  '@grepai/core/internal/services/file-indexer/FileIndexer',
  {
    effect: Effect.gen(function* () {
      const db = yield* Effect.serviceOption(SqlClient.SqlClient)
      const chunker = yield* Chunker
      const embedder = yield* Embedder
      const chunkStorage = yield* ChunkStorage
      const documentStorage = yield* DocumentStorage

      const clean = Effect.fnUntraced(
        function* (filePath: string) {
          yield* pipe(
            chunkStorage.removeByFilePath(filePath),
            Effect.zipRight(documentStorage.removeByFilePath(filePath)),
          )
        },
        (effect) =>
          Option.match(db, {
            onNone: () => effect,
            onSome: (db) =>
              db.withTransaction(effect).pipe(
                Effect.catchTags({
                  SqlError: (cause) => new IndexerError({ cause }),
                }),
              ),
          }),
      )

      const index = Effect.fnUntraced(
        function* (input: {
          filePath: string
          content: string
          hash: string
          language: SupportedLanguage
        }) {
          const { filePath, content, hash, language } = input

          const chunks = yield* chunker.chunk({
            filePath,
            content,
            language,
          })

          if (!Array.isNonEmptyReadonlyArray(chunks)) {
            return
          }

          const chunkBatches = Array.chunksOf(chunks, 100)

          const embeddings = yield* Effect.forEach(chunkBatches, (chunks) =>
            embedder
              .embedMany(Array.map(chunks, ({ content }) => content))
              .pipe(
                Effect.map(
                  Array.map((embedding, index) => ({
                    chunkId: chunks[index]!.id,
                    embedding,
                  })),
                ),
              ),
          ).pipe(Effect.map(Array.flatten))

          yield* pipe(
            documentStorage.insert({ filePath, hash }),
            Effect.zipRight(chunkStorage.insertMany(chunks)),
            Effect.zipRight(chunkStorage.insertManyEmbeddings(embeddings)),
          )
        },
        (effect) =>
          Option.match(db, {
            onNone: () => effect,
            onSome: (db) =>
              db.withTransaction(effect).pipe(
                Effect.catchTags({
                  SqlError: (cause) => new IndexerError({ cause }),
                }),
              ),
          }),
      )

      return {
        clean,
        index,
      } as const
    }),
  },
) {}
