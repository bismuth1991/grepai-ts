import { SqlClient } from '@effect/sql'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import { TokenCounterCacheError } from '../../domain/errors'
import { TokenCounterCache } from '../../domain/token-counter-cache'

export const TokenCounterCacheSql = Layer.effect(
  TokenCounterCache,
  Effect.gen(function* () {
    const db = yield* SqlClient.SqlClient

    return TokenCounterCache.of({
      get: Effect.fnUntraced(
        function* ({ chunkHash, tokenizer }) {
          return yield* db
            .onDialectOrElse({
              orElse: () => db`
                SELECT
                  token_count
                FROM
                  token_counter_caches
                WHERE
                  chunk_hash = ${chunkHash}
                  , tokenizer = ${tokenizer}
              `,
            })
            .pipe(
              Effect.flatMap(Array.head),
              Effect.flatMap(
                Schema.decodeUnknown(
                  Schema.Struct({ tokenCount: Schema.Number }),
                ),
              ),
              Effect.map(({ tokenCount }) => tokenCount),
              Effect.catchTags({
                NoSuchElementException: () => Effect.succeed(undefined),
              }),
            )
        },
        Effect.catchTags({
          ParseError: (cause) => new TokenCounterCacheError({ cause }),
          SqlError: (cause) => new TokenCounterCacheError({ cause }),
        }),
      ),

      set: Effect.fnUntraced(
        function* ({ chunkHash, tokenizer }, tokenCount) {
          yield* db.onDialectOrElse({
            orElse: () => db`
              INSERT INTO token_counter_caches (
                chunk_hash
                , tokenizer
                , token_count
              )
              VALUES (
                ${chunkHash}
                , ${tokenizer}
                , ${tokenCount}
              )
              ON CONFLICT (chunk_hash, tokenizer)
              DO UPDATE SET
                token_count = ${tokenCount}
            `,
          })
        },
        Effect.catchTags({
          SqlError: (cause) => new TokenCounterCacheError({ cause }),
        }),
      ),
    })
  }),
)
