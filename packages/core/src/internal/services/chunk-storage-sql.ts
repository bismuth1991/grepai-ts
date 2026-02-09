import { SqlClient } from '@effect/sql'
import { pipe } from 'effect'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import {
  ChunkEmbeddingInsertInput,
  ChunkInsertInput,
  ChunkSearchResult,
} from '../../domain/chunk'
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
        const { query, topK = 10 } = input

        const queryEmbedding = yield* embedder.embedQuery(query)

        return yield* db
          .onDialectOrElse({
            pg: () => db`
              SELECT
                c.file_path
                , c.start_line
                , c.end_line
              FROM
                chunk_embeddings ce
              INNER JOIN
                chunks c ON c.id = ce.chunk_id
              ORDER BY ce.embedding <=> ${queryEmbedding}::vector
              LIMIT ${topK}
            `,
            orElse: () => db`
              SELECT
                c.file_path
                , c.start_line
                , c.end_line
              FROM
                vector_top_k(
                  'idx_chunk_embeddings_embedding'
                  , vector32(${queryEmbedding})
                  , ${topK}
                ) v
              INNER JOIN
                chunk_embeddings ce ON ce.rowid = v.id
              INNER JOIN
                chunks c ON c.id = ce.chunk_id
            `,
          })
          .pipe(
            Effect.flatMap(
              Schema.decodeUnknown(Schema.Array(ChunkSearchResult)),
            ),
          )
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
        SqlError: (cause) => new ChunkStorageError({ cause }),
      }),
    )

    const getAllWithoutEmbedding = Effect.fnUntraced(
      function* () {
        return yield* db
          .onDialectOrElse({
            orElse: () => db`
              SELECT
                c.id
                , c.content
              FROM
                chunks c
              LEFT JOIN
                chunk_embeddings ce ON ce.chunk_id = c.id
              WHERE
                ce.id IS NULL
            `,
          })
          .pipe(
            Effect.flatMap(
              Schema.decodeUnknown(
                Schema.Array(
                  Schema.Struct({
                    id: Schema.String,
                    content: Schema.String,
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
          Effect.flatMap(Schema.decodeUnknown(Schema.Array(ChunkInsertInput))),
          Effect.map(
            Array.map((chunk) => ({
              ...chunk,
              createdAt: now,
            })),
          ),
        )

        yield* db.onDialectOrElse({
          orElse: () => db`
            INSERT INTO chunks
            ${db.insert(chunksToInsert)}
          `,
        })
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
        SqlError: (cause) => new ChunkStorageError({ cause }),
      }),
    )

    const insertManyEmbeddings = Effect.fnUntraced(
      function* (embeddings: ReadonlyArray<ChunkEmbeddingInsertInput>) {
        const now = new Date().toISOString()
        const embeddingsToInsert = yield* Effect.succeed(embeddings).pipe(
          Effect.flatMap(
            Schema.decodeUnknown(Schema.Array(ChunkEmbeddingInsertInput)),
          ),
          Effect.map(
            Array.map(({ chunkId, embedding }) => ({
              chunkId,
              embedding,
              createdAt: now,
            })),
          ),
        )

        yield* db.onDialectOrElse({
          pg: () => db`
            INSERT INTO chunk_embeddings (
              chunk_id
              , embedding
              , created_at
            )
            VALUES
            ${db.unsafe(
              Array.map(
                embeddingsToInsert,
                ({ chunkId, embedding, createdAt }) =>
                  `('${chunkId}', '${embedding}'::vector, '${createdAt}')`,
              ).join(',\n'),
            )}
          `,
          orElse: () => db`
            INSERT INTO chunk_embeddings (
              chunk_id
              , embedding
              , created_at
            )
            VALUES
            ${db.unsafe(
              Array.map(
                embeddingsToInsert,
                ({ chunkId, embedding, createdAt }) =>
                  `('${chunkId}', vector32('${embedding}'), '${createdAt}')`,
              ).join(',\n'),
            )}
          `,
        })
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
        SqlError: (cause) => new ChunkStorageError({ cause }),
      }),
    )

    const removeByFilePath = Effect.fnUntraced(
      function* (filePath: string) {
        yield* pipe(
          db.onDialectOrElse({
            orElse: () => db`
              DELETE FROM
                chunk_embeddings
              WHERE chunk_id IN (
                SELECT id FROM chunks WHERE file_path = ${filePath}
              );
            `,
          }),
          Effect.zipRight(
            db.onDialectOrElse({
              orElse: () => db`
                DELETE FROM
                  chunks
                WHERE
                  file_path = ${filePath}
              `,
            }),
          ),
          db.withTransaction,
        )
      },

      Effect.catchTags({
        SqlError: (cause) => new ChunkStorageError({ cause }),
      }),
    )

    return ChunkStorage.of({
      search,
      getAllWithoutEmbedding,
      insertMany,
      insertManyEmbeddings,
      removeByFilePath,
    })
  }),
)
