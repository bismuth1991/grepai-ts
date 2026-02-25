import type { DocumentInsertInput } from '../../domain/document'

import { SqlClient } from '@effect/sql'
import { Glob } from 'bun'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'

import { Document } from '../../domain/document'
import { DocumentStorage } from '../../domain/document-storage'
import {
  DocumentNotFound,
  DocumentStorageError,
  SchemaValidationFailed,
} from '../../domain/errors'

export const DocumentStorageSql = Layer.effect(
  DocumentStorage,
  Effect.gen(function* () {
    const db = yield* SqlClient.SqlClient

    const getByFilePath = Effect.fnUntraced(
      function* (filePath: string) {
        return yield* db
          .onDialectOrElse({
            orElse: () => db`
              SELECT
                id
                , file_path
                , hash
                , created_at
                , updated_at
              FROM
                documents
              WHERE
                file_path = ${filePath}
              LIMIT 1
            `,
          })
          .pipe(
            Effect.flatMap(Array.head),
            Effect.flatMap(Schema.decodeUnknown(Document)),
          )
      },
      (effect, filePath) =>
        effect.pipe(
          Effect.catchTags({
            ParseError: (cause) => new SchemaValidationFailed({ cause }),
            NoSuchElementException: () => new DocumentNotFound({ filePath }),
            SqlError: (cause) => new DocumentStorageError({ cause }),
          }),
        ),
    )

    const getAll = Effect.fnUntraced(
      function* () {
        return yield* db
          .onDialectOrElse({
            orElse: () => db`
              SELECT
                id
                , file_path
                , hash
                , created_at
                , updated_at
              FROM
                documents
            `,
          })
          .pipe(Effect.flatMap(Schema.decodeUnknown(Schema.Array(Document))))
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
        SqlError: (cause) => new DocumentStorageError({ cause }),
      }),
    )

    const glob = Effect.fnUntraced(
      function* (input: { pattern: string }) {
        const { pattern } = input
        const matcher = new Glob(pattern)

        return yield* db
          .onDialectOrElse({
            orElse: () => db`
              SELECT
                d.file_path
              FROM
                documents d
            `,
          })
          .pipe(
            Effect.flatMap(
              Schema.decodeUnknown(
                Schema.Array(Schema.Struct({ filePath: Schema.String })),
              ),
            ),
            Effect.map(
              Array.filterMap(({ filePath }) =>
                matcher.match(filePath) ? Option.some(filePath) : Option.none(),
              ),
            ),
          )
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
        SqlError: (cause) => new DocumentStorageError({ cause }),
      }),
    )

    const insert = Effect.fnUntraced(
      function* (document: DocumentInsertInput) {
        const now = new Date().toISOString()

        yield* db.onDialectOrElse({
          orElse: () => db`
            INSERT INTO documents (
              file_path
              , hash
              , created_at
              , updated_at
            )
            VALUES (
              ${document.filePath}
              , ${document.hash}
              , ${now}
              , ${now}
            )
            ON CONFLICT DO NOTHING
          `,
        })
      },
      Effect.catchTags({
        SqlError: (cause) => new DocumentStorageError({ cause }),
      }),
    )

    const removeByFilePath = Effect.fnUntraced(
      function* (filePath: string) {
        yield* db.onDialectOrElse({
          orElse: () => db`
            DELETE FROM
              documents
            WHERE
              file_path = ${filePath}
          `,
        })
      },
      Effect.catchTags({
        SqlError: (cause) => new DocumentStorageError({ cause }),
      }),
    )

    return DocumentStorage.of({
      getAll,
      getByFilePath,
      glob,
      insert,
      removeByFilePath,
    })
  }),
)
