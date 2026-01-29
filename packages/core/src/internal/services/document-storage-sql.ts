import type { DocumentInsertInput } from '../../domain/document'

import { SqlClient } from '@effect/sql'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import { Document } from '../../domain/document'
import { DocumentStorage } from '../../domain/document-storage'
import { DocumentNotFound, SchemaValidationFailed } from '../../domain/errors'

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
      }),
    )

    const insert = Effect.fnUntraced(function* (document: DocumentInsertInput) {
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
          `,
      })
    })

    const removeByFilePath = Effect.fnUntraced(function* (filePath: string) {
      yield* db.onDialectOrElse({
        orElse: () => db`
          DELETE FROM
            documents
          WHERE
            file_path = ${filePath}
        `,
      })
    })

    return DocumentStorage.of({
      getAll,
      getByFilePath,
      insert,
      removeByFilePath,
    })
  }),
)
