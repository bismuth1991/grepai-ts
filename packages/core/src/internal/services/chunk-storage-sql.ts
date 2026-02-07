import { SqlClient } from '@effect/sql'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import { ChunkInsertInput } from '../../domain/chunk'
import { ChunkStorage } from '../../domain/chunk-storage'
import { Embedder } from '../../domain/embedder'
import { ChunkStorageError, SchemaValidationFailed } from '../../domain/errors'

export const ChunkStorageSql = Layer.effect(
  ChunkStorage,
  Effect.gen(function* () {
    const db = yield* SqlClient.SqlClient
    const embedder = yield* Embedder

    const search = Effect.fnUntraced(
      function* (input: { query: string; topK?: number }) {
        const { query, topK } = input

        const queryEmbedding = yield* embedder.embedQuery(query)

        return yield* db
          .onDialectOrElse({
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
          .pipe(
            Effect.flatMap(
              Schema.decodeUnknown(
                Schema.Array(
                  Schema.Struct({
                    filePath: Schema.String,
                    startLine: Schema.Number,
                    endLine: Schema.Number,
                  }),
                ),
              ),
            ),
          )
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
        SqlError: (cause) => new ChunkStorageError({ cause }),
      }),
    )

    const insertMany = Effect.fnUntraced(
      function* (chunks: ReadonlyArray<ChunkInsertInput>) {
        const now = new Date().toISOString()
        const chunksToInsert = yield* Effect.succeed(chunks).pipe(
          Effect.flatMap(
            Schema.decodeUnknown(Schema.NonEmptyArray(ChunkInsertInput)),
          ),
          Effect.map(
            Array.map((chunk) => ({
              ...chunk,
              createdAt: now,
              updatedAt: now,
            })),
          ),
        )

        yield* Effect.forEach(chunksToInsert, (chunk) =>
          db.onDialectOrElse({
            orElse: () => db`
              INSERT INTO chunks (
                chunk_id
                , file_path
                , start_line
                , end_line
                , content
                , embedding
                , hash
                , created_at
                , updated_at
              )
              VALUES (
                ${chunk.chunkId}
                , ${chunk.filePath}
                , ${chunk.startLine}
                , ${chunk.endLine}
                , ${chunk.content}
                , vector32(${chunk.embedding})
                , ${chunk.hash}
                , ${chunk.createdAt}
                , ${chunk.updatedAt}
              )
            `,
          }),
        )
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
        SqlError: (cause) => new ChunkStorageError({ cause }),
      }),
    )

    const removeByFilePath = Effect.fnUntraced(
      function* (filePath: string) {
        yield* db.onDialectOrElse({
          orElse: () => db`
            DELETE FROM
              chunks
            WHERE
              file_path = ${filePath}
          `,
        })
      },

      Effect.catchTags({
        SqlError: (cause) => new ChunkStorageError({ cause }),
      }),
    )

    return ChunkStorage.of({
      search,
      insertMany,
      removeByFilePath,
    })
  }),
)
