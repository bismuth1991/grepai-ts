import { SqlClient } from '@effect/sql'
import { LibsqlMigrator, LibsqlClient } from '@effect/sql-libsql'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Redacted from 'effect/Redacted'
import * as String from 'effect/String'

import { Config } from '../../domain/config'

const LibsqlClientLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* Config

    return LibsqlClient.layer({
      url: config.storage.url,
      authToken: Redacted.make(config.storage.authToken),
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
    })
  }),
)

const MigratorLive = LibsqlMigrator.layer({
  loader: LibsqlMigrator.fromRecord({
    '202601282204_create_documents_table': Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms()

      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE TABLE IF NOT EXISTS documents (
              id           INTEGER PRIMARY KEY
              , file_path  TEXT NOT NULL
              , hash       TEXT NOT NULL
              , created_at TEXT NOT NULL
              , updated_at TEXT NOT NULL
            );
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_documents_file_path
              ON documents (file_path);
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE INDEX IF NOT EXISTS idx_documents_hash
              ON documents (hash);
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE INDEX IF NOT EXISTS idx_documents_updated_at
              ON documents (updated_at);
          `,
      })
    }),
    '202601282212_create_chunks_table': Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms()

      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE TABLE IF NOT EXISTS chunks (
              id           INTEGER PRIMARY KEY
              , chunk_id   TEXT NOT NULL
              , file_path  TEXT NOT NULL
              , start_line INTEGER NOT NULL
              , end_line   INTEGER NOT NULL
              , content    TEXT NOT NULL
              , embedding  F32_BLOB(3072) NOT NULL
              , hash       TEXT NOT NULL
              , created_at TEXT NOT NULL
              , updated_at TEXT NOT NULL
            );
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_chunks_chunk_id
              ON chunks (chunk_id);
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE INDEX IF NOT EXISTS idx_chunks_file_path
              ON chunks (file_path);
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE INDEX IF NOT EXISTS idx_chunks_hash
              ON chunks (hash);
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE INDEX IF NOT EXISTS idx_chunks_updated_at
              ON chunks (updated_at);
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE INDEX IF NOT EXISTS idx_chunks_vector
              ON chunks(
                libsql_vector_idx(
                  embedding
                  , 'metric=cosine'
                  , 'compress_neighbors=float32'
                  , 'alpha=1.4'
                  , 'search_l=400'
                  , 'insert_l=150'
                )
              );
          `,
      })
    }),
    '202605020643_create_token_counter_caches_table': Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms()

      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE TABLE IF NOT EXISTS token_counter_caches (
              id            INTEGER PRIMARY KEY
              , chunk_hash  TEXT NOT NULL
              , tokenizer   TEXT NOT NULL
              , token_count INTEGER NOT NULL
              , created_at  TEXT NOT NULL
            );
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_token_counter_caches_chunk_hash_tokenizer
              ON token_counter_caches (chunk_hash, tokenizer);
          `,
      })
    }),
    '202605020650_create_embedding_caches_table': Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms()

      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE TABLE IF NOT EXISTS embedding_caches (
              id           INTEGER PRIMARY KEY
              , hash       TEXT NOT NULL
              , embedding  TEXT NOT NULL
              , created_at TEXT NOT NULL
            );
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_embedding_caches_hash
              ON embedding_caches (hash);
          `,
      })
    }),
  }),
}).pipe(Layer.provide(LibsqlClientLive))

export const LibsqlLive = Layer.mergeAll(MigratorLive, LibsqlClientLive)
