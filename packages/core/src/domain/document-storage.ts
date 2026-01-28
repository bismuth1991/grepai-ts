import type { Document } from './document'

import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

export class DocumentStorage extends Context.Tag(
  '@grepai/core/domain/document-storage/DocumentStorage',
)<
  DocumentStorage,
  {
    getByFilePath: (
      filePath: string,
    ) => Effect.Effect<Document, Schema.Defect, never>

    insert: (document: Document) => Effect.Effect<void, Schema.Defect, never>

    removeByFilePath: (
      filePath: string,
    ) => Effect.Effect<void, Schema.Defect, never>

    getAll: () => Effect.Effect<ReadonlyArray<Document>, Schema.Defect, never>
  }
>() {}
