import { Glob } from 'bun'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'

import {
  DocumentNotFound,
  DocumentStorageError,
  SchemaValidationFailed,
} from '../../domain'
import { Document } from '../../domain/document'
import { DocumentStorage } from '../../domain/document-storage'

import { LanceDb } from './lancedb'

export const DocumentStorageLanceDb = Layer.effect(
  DocumentStorage,
  Effect.gen(function* () {
    const db = yield* LanceDb

    const getByFilePath = Effect.fnUntraced(
      function* (filePath: string) {
        return yield* db
          .useTable((t) =>
            t
              .query()
              .where(`filePath = "${filePath}"`)
              .select(['id', 'filePath', 'fileHash', 'createdAt', 'updatedAt'])
              .limit(1)
              .toArray(),
          )
          .pipe(
            Effect.map(
              Array.map((doc) => ({
                ...doc,
                hash: doc.fileHash,
              })),
            ),
            Effect.flatMap(Schema.decodeUnknown(Schema.Array(Document))),
            Effect.flatMap(Array.head),
          )
      },
      (effect, filePath) =>
        effect.pipe(
          Effect.catchTags({
            ParseError: (cause) => new SchemaValidationFailed({ cause }),
            NoSuchElementException: () => new DocumentNotFound({ filePath }),
            LanceDbError: (cause) => new DocumentStorageError({ cause }),
          }),
        ),
    )

    const getAll = Effect.fnUntraced(
      function* () {
        return yield* db
          .useTable((t) =>
            t
              .query()
              .select(['id', 'filePath', 'fileHash', 'createdAt', 'updatedAt'])
              .toArray(),
          )
          .pipe(
            Effect.map(
              Array.map((doc) => ({
                ...doc,
                hash: doc.fileHash,
              })),
            ),
            Effect.flatMap(Schema.decodeUnknown(Schema.Array(Document))),
          )
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
        LanceDbError: (cause) => new DocumentStorageError({ cause }),
      }),
    )

    const glob = Effect.fnUntraced(
      function* (input: { pattern: string }) {
        const { pattern } = input
        const matcher = new Glob(pattern)

        return yield* db
          .useTable((t) => t.query().select(['filePath']).toArray())
          .pipe(
            Effect.flatMap(
              Schema.decodeUnknown(
                Schema.Array(
                  Schema.Struct({
                    filePath: Schema.String,
                  }),
                ),
              ),
            ),
            Effect.map(Array.dedupe),
            Effect.map(
              Array.filterMap(({ filePath }) =>
                matcher.match(filePath) ? Option.some(filePath) : Option.none(),
              ),
            ),
          )
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
        LanceDbError: (cause) => new DocumentStorageError({ cause }),
      }),
    )

    const insert = db.insertDocument

    const removeByFilePath = Effect.fnUntraced(
      function* (filePath: string) {
        yield* db.useTable((t) => t.delete(`filePath = "${filePath}"`))
      },
      Effect.catchTags({
        LanceDbError: (cause) => new DocumentStorageError({ cause }),
      }),
    )

    return DocumentStorage.of({
      getByFilePath,
      getAll,
      glob,
      insert,
      removeByFilePath,
    })
  }),
)
