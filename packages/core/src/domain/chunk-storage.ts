import type { Chunk } from './chunk'

import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

export class ChunkStorage extends Context.Tag(
  '@grepai/core/domain/chunk-storage/ChunkStorage',
)<
  ChunkStorage,
  {
    getByFilePath: (
      filePath: string,
    ) => Effect.Effect<ReadonlyArray<Chunk>, Schema.Defect, never>

    getAll: () => Effect.Effect<ReadonlyArray<Chunk>, Schema.Defect, never>

    insertMany: (
      chunks: ReadonlyArray<Chunk>,
    ) => Effect.Effect<void, Schema.Defect, never>

    removeByFilePath: (
      filePath: string,
    ) => Effect.Effect<void, Schema.Defect, never>
  }
>() {}
