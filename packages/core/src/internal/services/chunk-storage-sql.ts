import { SqlClient } from '@effect/sql'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import { Chunk, ChunkInsertInput } from '../../domain/chunk'
import { ChunkStorage } from '../../domain/chunk-storage'
import { SchemaValidationFailed } from '../../domain/errors'

export const ChunkStorageSql = Layer.effect(
  ChunkStorage,
  Effect.gen(function* () {
    const db = yield* SqlClient.SqlClient

    const getByFilePath = Effect.fnUntraced(
      function* (filePath: string) {
        return yield* db
          .onDialectOrElse({
            orElse: () => db`
              SELECT
                id
                , chunk_id
                , file_path
                , start_line
                , end_line
                , content
                , vector_extract(embedding)
                , hash
                , created_at
                , updated_at
              FROM
                chunks
              WHERE
                file_path = ${filePath}
            `,
          })
          .pipe(Effect.flatMap(Schema.decodeUnknown(Schema.Array(Chunk))))
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
      }),
    )

    const getAll = Effect.fnUntraced(
      function* () {
        return yield* db
          .onDialectOrElse({
            orElse: () => db`
              SELECT
                id
                , chunk_id
                , file_path
                , start_line
                , end_line
                , content
                , vector_extract(embedding)
                , hash
                , created_at
                , updated_at
              FROM
                chunks
            `,
          })
          .pipe(Effect.flatMap(Schema.decodeUnknown(Schema.Array(Chunk))))
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
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
        ).pipe(db.withTransaction)
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
      }),
    )

    const removeByFilePath = Effect.fnUntraced(function* (filePath: string) {
      yield* db.onDialectOrElse({
        orElse: () => db`
          DELETE FROM
            chunks
          WHERE
            file_path = ${filePath}
        `,
      })
    })

    return ChunkStorage.of({
      getByFilePath,
      getAll,
      insertMany,
      removeByFilePath,
    })
  }),
)
