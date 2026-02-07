import type { ChunkInsertInput } from './chunk'

import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import {
  ChunkStorageError,
  EmbeddingCacheError,
  SchemaValidationFailed,
  VercelAiError,
} from './errors'

export class ChunkStorage extends Context.Tag(
  '@grepai/core/domain/chunk-storage/ChunkStorage',
)<
  ChunkStorage,
  {
    search: (input: {
      query: string
      topK?: number
    }) => Effect.Effect<
      ReadonlyArray<{ filePath: string; startLine: number; endLine: number }>,
      | ChunkStorageError
      | SchemaValidationFailed
      | EmbeddingCacheError
      | VercelAiError,
      never
    >

    insertMany: (
      chunks: ReadonlyArray<ChunkInsertInput>,
    ) => Effect.Effect<void, ChunkStorageError | SchemaValidationFailed, never>

    removeByFilePath: (
      filePath: string,
    ) => Effect.Effect<void, ChunkStorageError, never>
  }
>() {}
