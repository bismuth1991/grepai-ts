import type {
  ChunkEmbeddingInsertInput,
  ChunkInsertInput,
  ChunkSearchResult,
} from './chunk'

import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import {
  ChunkStorageError,
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
      ReadonlyArray<ChunkSearchResult>,
      ChunkStorageError | SchemaValidationFailed | VercelAiError,
      never
    >

    getAllWithoutEmbedding: () => Effect.Effect<
      ReadonlyArray<{ id: string; content: string }>,
      ChunkStorageError | SchemaValidationFailed,
      never
    >

    insertMany: (
      chunks: ReadonlyArray<ChunkInsertInput>,
    ) => Effect.Effect<void, ChunkStorageError | SchemaValidationFailed, never>

    insertManyEmbeddings: (
      embeddings: ReadonlyArray<ChunkEmbeddingInsertInput>,
    ) => Effect.Effect<void, ChunkStorageError | SchemaValidationFailed, never>

    removeByFilePath: (
      filePath: string,
    ) => Effect.Effect<void, ChunkStorageError, never>
  }
>() {}
