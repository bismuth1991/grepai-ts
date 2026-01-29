import type { Chunk, ChunkInsertInput } from './chunk'

import { SqlError } from '@effect/sql'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import { SchemaValidationFailed } from './errors'

export class ChunkStorage extends Context.Tag(
  '@grepai/core/domain/chunk-storage/ChunkStorage',
)<
  ChunkStorage,
  {
    getByFilePath: (
      filePath: string,
    ) => Effect.Effect<
      ReadonlyArray<Chunk>,
      SchemaValidationFailed | SqlError.SqlError,
      never
    >

    getAll: () => Effect.Effect<
      ReadonlyArray<Chunk>,
      SchemaValidationFailed | SqlError.SqlError,
      never
    >

    insertMany: (
      chunks: ReadonlyArray<ChunkInsertInput>,
    ) => Effect.Effect<void, SchemaValidationFailed | SqlError.SqlError, never>

    removeByFilePath: (
      filePath: string,
    ) => Effect.Effect<void, SqlError.SqlError, never>
  }
>() {}
