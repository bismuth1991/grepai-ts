import { SqlClient } from '@effect/sql'
import { LibsqlMigrator, LibsqlClient } from '@effect/sql-libsql'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Redacted from 'effect/Redacted'
import * as String from 'effect/String'

import { ConfigLoader } from '../../domain/config-loader'

export const SqlClientLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const configLoader = yield* ConfigLoader
    const config = yield* configLoader.load()

    return LibsqlClient.layer({
      url: config.storage.url,
      authToken: Redacted.make(config.storage.authToken),
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
    })
  }),
)

export const MigratorLive = LibsqlMigrator.layer({
  loader: LibsqlMigrator.fromRecord({
    '2026-01-28-2204_create_documents_table': Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms()

      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE TABLE IF NOT EXISTS documents (
              file_path  TEXT NOT NULL,
              project_id TEXT NOT NULL,
              hash       TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,

              PRIMARY KEY (project_id, file_path)
            );
          `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
            CREATE INDEX IF NOT EXISTS idx_documents_project_id
              ON documents (project_id);

            CREATE INDEX IF NOT EXISTS idx_documents_file_path
              ON documents (file_path);

            CREATE INDEX IF NOT EXISTS idx_documents_hash
              ON documents (hash);

            CREATE INDEX IF NOT EXISTS idx_documents_updated_at
              ON documents (updated_at);
          `,
      })
    }),
    '2026-01-28-2212_create_chunks_table': Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms()

      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
          CREATE TABLE IF NOT EXISTS chunks (
            id         TEXT NOT NULL,
            project_id TEXT NOT NULL,
            file_path  TEXT NOT NULL,
            start_line INTEGER NOT NULL,
            end_line   INTEGER NOT NULL,
            content    TEXT NOT NULL,
            vector     F32_BLOB(3072) NOT NULL,
            hash       TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,

            PRIMARY KEY (id, project_id)
          );
        `,
      })
      yield* sql.onDialectOrElse({
        orElse: () =>
          sql`
          CREATE INDEX IF NOT EXISTS idx_chunks_project_id
            ON chunks (project_id);

          CREATE INDEX IF NOT EXISTS idx_chunks_project_id_file_path
            ON chunks (project_id, file_path);

          CREATE INDEX IF NOT EXISTS idx_chunks_file_path
            ON chunks (file_path);

          CREATE INDEX IF NOT EXISTS idx_chunks_hash
            ON chunks (hash);

          CREATE INDEX IF NOT EXISTS idx_chunks_updated_at
            ON chunks (updated_at);
        `,
      })
    }),
  }),
})
