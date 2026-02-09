import { SqlClient } from '@effect/sql'
import { PgClient, PgMigrator } from '@effect/sql-pg'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Redacted from 'effect/Redacted'
import * as String from 'effect/String'

import { Config } from '../../domain/config'

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL Client Layer
// ─────────────────────────────────────────────────────────────────────────────

const PgClientLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* Config

    if (config.storage.type !== 'postgres') {
      return Layer.fail(new Error('Expected postgres storage configuration'))
    }

    return PgClient.layer({
      url: Redacted.make(config.storage.connectionString),
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
    })
  }),
)

const PgMigratorLive = PgMigrator.layer({
  loader: PgMigrator.fromRecord({
    '0001_create_documents_table': Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms()

      yield* sql`
        CREATE TABLE IF NOT EXISTS documents (
          id           SERIAL PRIMARY KEY
          , file_path  TEXT NOT NULL
          , hash       TEXT NOT NULL
          , created_at TIMESTAMPTZ NOT NULL
          , updated_at TIMESTAMPTZ NOT NULL
        );
      `
      yield* sql`
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_documents_file_path
          ON documents (file_path);
      `
      yield* sql`
        CREATE INDEX IF NOT EXISTS idx_documents_hash
          ON documents (hash);
      `
    }),
    '0002_create_chunks_table': Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms()

      yield* sql`
        CREATE TABLE IF NOT EXISTS chunks (
          id           TEXT PRIMARY KEY
          , file_path  TEXT NOT NULL
          , start_line INTEGER NOT NULL
          , end_line   INTEGER NOT NULL
          , content    TEXT NOT NULL
          , created_at TIMESTAMPTZ NOT NULL
        );
      `
      yield* sql`
        CREATE INDEX IF NOT EXISTS idx_chunks_file_path
          ON chunks (file_path);
      `
    }),
    '0003_create_chunk_embeddings_table': Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms()

      yield* sql`CREATE EXTENSION IF NOT EXISTS vector;`

      yield* sql`
        CREATE TABLE IF NOT EXISTS chunk_embeddings (
          id           SERIAL PRIMARY KEY
          , chunk_id   TEXT NOT NULL
          , embedding  vector(3072) NOT NULL
          , created_at TIMESTAMPTZ NOT NULL
        );
      `
      yield* sql`
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_chunk_embeddings_chunk_id
          ON chunk_embeddings (chunk_id);
      `
      yield* sql`
        CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_embedding
          ON chunk_embeddings 
          USING hnsw (embedding vector_cosine_ops)
          WITH (m = 16, ef_construction = 64);
      `
    }),
  }),
}).pipe(Layer.provide(PgClientLive))

export const PostgresLive = Layer.mergeAll(PgMigratorLive, PgClientLive)
