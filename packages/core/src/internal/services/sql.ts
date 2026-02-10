import { Migrator, SqlClient } from '@effect/sql'
import { LibsqlMigrator, LibsqlClient } from '@effect/sql-libsql'
import { PgClient, PgMigrator } from '@effect/sql-pg'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Redacted from 'effect/Redacted'
import * as String from 'effect/String'

import { Config } from '../../domain/config'

const Migrations = Migrator.fromRecord({
  '0001_create_documents_table': Effect.gen(function* () {
    const db = (yield* SqlClient.SqlClient).withoutTransforms()

    yield* db.onDialectOrElse({
      pg: () =>
        db`
          CREATE TABLE IF NOT EXISTS documents (
            id           SERIAL PRIMARY KEY
            , file_path  TEXT NOT NULL
            , hash       TEXT NOT NULL
            , created_at TIMESTAMPTZ NOT NULL
            , updated_at TIMESTAMPTZ NOT NULL
          );
        `,
      orElse: () =>
        db`
          CREATE TABLE IF NOT EXISTS documents (
            id           INTEGER PRIMARY KEY
            , file_path  TEXT NOT NULL
            , hash       TEXT NOT NULL
            , created_at TEXT NOT NULL
            , updated_at TEXT NOT NULL
          );
        `,
    })
    yield* db.onDialectOrElse({
      pg: () =>
        db`
          CREATE UNIQUE INDEX IF NOT EXISTS uniq_documents_file_path
            ON documents (file_path);
        `,
      orElse: () =>
        db`
          CREATE UNIQUE INDEX IF NOT EXISTS uniq_documents_file_path
            ON documents (file_path);
        `,
    })
    yield* db.onDialectOrElse({
      pg: () =>
        db`
          CREATE INDEX IF NOT EXISTS idx_documents_hash
            ON documents (hash);
        `,
      orElse: () =>
        db`
          CREATE INDEX IF NOT EXISTS idx_documents_hash
            ON documents (hash);
        `,
    })
  }),
  '0002_create_chunks_table': Effect.gen(function* () {
    const db = (yield* SqlClient.SqlClient).withoutTransforms()

    yield* db.onDialectOrElse({
      pg: () =>
        db`
          CREATE TABLE IF NOT EXISTS chunks (
            id           TEXT PRIMARY KEY
            , file_path  TEXT NOT NULL
            , start_line INTEGER NOT NULL
            , end_line   INTEGER NOT NULL
            , content    TEXT NOT NULL
            , created_at TIMESTAMPTZ NOT NULL
          );
        `,
      orElse: () =>
        db`
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
    yield* db.onDialectOrElse({
      pg: () =>
        db`
          CREATE INDEX IF NOT EXISTS idx_chunks_file_path
            ON chunks (file_path);
        `,
      orElse: () =>
        db`
          CREATE INDEX IF NOT EXISTS idx_chunks_file_path
            ON chunks (file_path);
        `,
    })
  }),
  '0003_create_chunk_embeddings_table': Effect.gen(function* () {
    const db = (yield* SqlClient.SqlClient).withoutTransforms()

    yield* db.onDialectOrElse({
      pg: () => db`CREATE EXTENSION IF NOT EXISTS vector;`,
      orElse: () => db`SELECT 1;`, // no-op
    })
    yield* db.onDialectOrElse({
      pg: () =>
        db`
          CREATE TABLE IF NOT EXISTS chunk_embeddings (
            id           SERIAL PRIMARY KEY
            , chunk_id   TEXT NOT NULL
            , embedding  vector(3072) NOT NULL
            , created_at TIMESTAMPTZ NOT NULL
          );
        `,
      orElse: () =>
        db`
          CREATE TABLE IF NOT EXISTS chunk_embeddings (
            id           INTEGER PRIMARY KEY
            , chunk_id   TEXT NOT NULL
            , embedding  F32_BLOB(3072) NOT NULL
            , created_at TEXT NOT NULL
          );
        `,
    })
    yield* db.onDialectOrElse({
      pg: () =>
        db`
          CREATE UNIQUE INDEX IF NOT EXISTS uniq_chunk_embeddings_chunk_id
            ON chunk_embeddings (chunk_id);
        `,
      orElse: () =>
        db`
          CREATE UNIQUE INDEX IF NOT EXISTS uniq_chunk_embeddings_chunk_id
            ON chunk_embeddings (chunk_id);
        `,
    })
    yield* db.onDialectOrElse({
      pg: () =>
        db`
          CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_embedding
            ON chunk_embeddings
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
        `,
      orElse: () =>
        db`
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
})

export const LibsqlLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* Config

    if (config.storage.type !== 'turso') {
      return Layer.fail(new Error('`turso` storage expected'))
    }

    return LibsqlMigrator.layer({
      loader: Migrations,
    }).pipe(
      Layer.provideMerge(
        LibsqlClient.layer({
          url: config.storage.url,
          authToken: Redacted.make(config.storage.authToken),
          transformQueryNames: String.camelToSnake,
          transformResultNames: String.snakeToCamel,
        }),
      ),
    )
  }),
)

export const PgLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* Config

    if (config.storage.type !== 'postgres') {
      return Layer.fail(new Error('`postgres` storage expected'))
    }

    return PgMigrator.layer({
      loader: Migrations,
    }).pipe(
      Layer.provideMerge(
        PgClient.layer({
          url: Redacted.make(config.storage.connectionString),
          transformQueryNames: String.camelToSnake,
          transformResultNames: String.snakeToCamel,
        }),
      ),
    )
  }),
)
