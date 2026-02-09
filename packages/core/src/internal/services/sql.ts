import { SqlClient } from '@effect/sql'
import { LibsqlMigrator, LibsqlClient } from '@effect/sql-libsql'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Redacted from 'effect/Redacted'
import * as String from 'effect/String'

import { Config } from '../../domain/config'

// ─────────────────────────────────────────────────────────────────────────────
// LibSQL (Turso) Client Layer
// ─────────────────────────────────────────────────────────────────────────────

const LibsqlClientLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* Config

    if (config.storage.type !== 'turso') {
      return Layer.fail(new Error('Expected turso storage configuration'))
    }

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
    '0001_create_documents_table': Effect.gen(function* () {
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
    }),
    '0002_create_chunks_table': Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms()

      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE TABLE IF NOT EXISTS chunks (
              id           TEXT PRIMARY KEY
              , file_path  TEXT NOT NULL
              , start_line INTEGER NOT NULL
              , end_line   INTEGER NOT NULL
              , content    TEXT NOT NULL
              , created_at TEXT NOT NULL
            );
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE INDEX IF NOT EXISTS idx_chunks_file_path
              ON chunks (file_path);
          `,
      })
    }),
    '0003_create_chunk_embeddings_table': Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms()

      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE TABLE IF NOT EXISTS chunk_embeddings (
              id           INTEGER PRIMARY KEY
              , chunk_id   TEXT NOT NULL
              , embedding  F32_BLOB(3072) NOT NULL
              , created_at TEXT NOT NULL
            );
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_chunk_embeddings_chunk_id
              ON chunk_embeddings (chunk_id);
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_embedding
              ON chunk_embeddings (
                libsql_vector_idx(
                  embedding
                  , 'metric=cosine'
                  , 'compress_neighbors=float8'
                  , 'alpha=1.2'
                  , 'search_l=200'
                  , 'insert_l=70'
                )
              );
          `,
      })
    }),
  }),
}).pipe(Layer.provide(LibsqlClientLive))

export const LibsqlLive = Layer.mergeAll(MigratorLive, LibsqlClientLive)
