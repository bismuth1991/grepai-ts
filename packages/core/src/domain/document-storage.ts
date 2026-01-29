import type { Document } from './document'

import { SqlError } from '@effect/sql'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import { DocumentNotFound, SchemaValidationFailed } from './errors'

export class DocumentStorage extends Context.Tag(
  '@grepai/core/domain/document-storage/DocumentStorage',
)<
  DocumentStorage,
  {
    getByFilePath: (
      filePath: string,
    ) => Effect.Effect<
      Document,
      SqlError.SqlError | SchemaValidationFailed | DocumentNotFound,
      never
    >

    insert: (
      document: Document,
    ) => Effect.Effect<void, SqlError.SqlError, never>

    removeByFilePath: (
      filePath: string,
    ) => Effect.Effect<void, SqlError.SqlError, never>

    getAll: () => Effect.Effect<
      ReadonlyArray<Document>,
      SqlError.SqlError | SchemaValidationFailed,
      never
    >
  }
>() {}
