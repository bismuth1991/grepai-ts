import type { EmbeddingKey } from '../../domain/embedding-cache'

import { SqlClient } from '@effect/sql'
import { pipe } from 'effect'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Hash from 'effect/Hash'
import * as Layer from 'effect/Layer'
import * as Record from 'effect/Record'
import * as Schema from 'effect/Schema'

import { Embedding } from '../../domain/embedding'
import { EmbeddingCache } from '../../domain/embedding-cache'
import { EmbeddingCacheError } from '../../domain/errors'

export const EmbeddingCacheSql = Layer.effect(
  EmbeddingCache,
  Effect.gen(function* () {
    const db = yield* SqlClient.SqlClient

    const hash = ({ chunk, embedder, taskType, dimensions }: EmbeddingKey) =>
      pipe(
        Hash.string(chunk),
        Hash.combine(Hash.string(embedder)),
        Hash.combine(Hash.string(taskType)),
        Hash.combine(Hash.number(dimensions)),
      ).toString()

    return EmbeddingCache.of({
      hash,

      get: Effect.fnUntraced(
        function* (key) {
          const hashKey = hash(key)

          return yield* db
            .onDialectOrElse({
              orElse: () => db`
                SELECT
                  embedding
                FROM
                  embedding_caches
                WHERE
                  hash = ${hashKey}
              `,
            })
            .pipe(
              Effect.flatMap(Array.head),
              Effect.flatMap(
                Schema.decodeUnknown(Schema.Struct({ embedding: Embedding })),
              ),
              Effect.map(({ embedding }) => embedding),
              Effect.catchTags({
                NoSuchElementException: () => Effect.succeed(undefined),
              }),
            )
        },
        Effect.catchTags({
          ParseError: (cause) => new EmbeddingCacheError({ cause }),
          SqlError: (cause) => new EmbeddingCacheError({ cause }),
        }),
      ),

      getMany: Effect.fnUntraced(
        function* (keys) {
          const hashKeys = Array.map(keys, (key) => ({
            hash: hash(key),
            chunk: key.chunk,
          }))

          const cached = yield* db
            .onDialectOrElse({
              orElse: () => db`
                SELECT
                  hash
                  , embedding
                FROM
                  embedding_caches
                WHERE
                  ${db.in('hash', hashKeys)}
              `,
            })
            .pipe(
              Effect.flatMap(
                Schema.decodeUnknown(
                  Schema.Array(
                    Schema.Struct({
                      hash: Schema.String,
                      embedding: Embedding,
                    }),
                  ),
                ),
              ),
              Effect.map((cached) =>
                Record.fromIterableBy(cached, ({ hash }) => hash),
              ),
            )

          return Array.map(hashKeys, ({ hash, chunk }) => {
            if (cached[hash]) {
              return {
                hash,
                chunk,
                embedding: cached[hash].embedding,
              }
            }
            return {
              hash,
              chunk,
              embedding: undefined,
            }
          })
        },
        Effect.catchTags({
          ParseError: (cause) => new EmbeddingCacheError({ cause }),
          SqlError: (cause) => new EmbeddingCacheError({ cause }),
        }),
      ),

      set: Effect.fnUntraced(
        function* (key, embedding) {
          const now = new Date().toISOString()
          const hashKey = hash(key)

          yield* db.onDialectOrElse({
            orElse: () => db`
              INSERT INTO embedding_caches (
                hash
                , embedding
                , created_at
              )
              VALUES (
                ${hashKey}
                , ${embedding}
                , ${now}
              )
              ON CONFLICT (hash)
              DO UPDATE SET
                embedding = ${embedding}
            `,
          })
        },
        Effect.catchTags({
          SqlError: (cause) => new EmbeddingCacheError({ cause }),
        }),
      ),
    })
  }),
)
