import { SqlClient } from '@effect/sql'
import { pipe } from 'effect'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'

import { IndexerError, SupportedLanguage } from '../../domain'
import { ChunkStorage } from '../../domain/chunk-storage'
import { Chunker } from '../../domain/chunker'
import { DocumentStorage } from '../../domain/document-storage'
import { Embedder } from '../../domain/embedder'

export class FileIndexer extends Effect.Service<FileIndexer>()(
  '@grepai/core/internal/services/file-indexer/FileIndexer',
  {
    effect: Effect.gen(function* () {
      const db = yield* SqlClient.SqlClient
      const chunker = yield* Chunker
      const embedder = yield* Embedder
      const chunkStorage = yield* ChunkStorage
      const documentStorage = yield* DocumentStorage

      const clean = Effect.fnUntraced(
        function* (filePath: string) {
          yield* pipe(
            chunkStorage.removeByFilePath(filePath),
            Effect.zipRight(documentStorage.removeByFilePath(filePath)),
            db.withTransaction,
          )
        },
        Effect.catchTags({
          SqlError: (cause) => new IndexerError({ cause }),
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

          const embeddings = yield* embedder
            .embedMany(Array.map(chunks, ({ content }) => content))
            .pipe(
              Effect.map(
                Array.map((embedding, index) => ({
                  chunkId: chunks[index]!.id,
                  embedding,
                })),
              ),
            )

          yield* pipe(
            documentStorage.insert({ filePath, hash }),
            Effect.zipRight(chunkStorage.insertMany(chunks)),
            Effect.zipRight(chunkStorage.insertManyEmbeddings(embeddings)),
            db.withTransaction,
          )
        },
        Effect.catchTags({
          SqlError: (cause) => new IndexerError({ cause }),
        }),
      )

      return {
        clean,
        index,
      } as const
    }),
  },
) {}
