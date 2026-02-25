import type { Document, DocumentInsertInput } from './document'
import type {
  DocumentNotFound,
  DocumentStorageError,
  SchemaValidationFailed,
} from './errors'

import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

export class DocumentStorage extends Context.Tag(
  '@grepai/core/domain/document-storage/DocumentStorage',
)<
  DocumentStorage,
  {
    getByFilePath: (
      filePath: string,
    ) => Effect.Effect<
      Document,
      DocumentStorageError | DocumentNotFound | SchemaValidationFailed,
      never
    >

    insert: (
      document: DocumentInsertInput,
    ) => Effect.Effect<void, DocumentStorageError, never>

    removeByFilePath: (
      filePath: string,
    ) => Effect.Effect<void, DocumentStorageError, never>

    getAll: () => Effect.Effect<
      ReadonlyArray<Document>,
      SchemaValidationFailed | DocumentStorageError,
      never
    >

    glob: (input: {
      pattern: string
    }) => Effect.Effect<
      ReadonlyArray<string>,
      DocumentStorageError | SchemaValidationFailed,
      never
    >
  }
>() {}
