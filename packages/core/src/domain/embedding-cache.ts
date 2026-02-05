import * as Array from 'effect/Array'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import { EmbeddingCacheError } from './errors'

export type EmbeddingKey = {
  chunk: string
  embedder: string
  taskType: string
  dimensions: number
}

export class EmbeddingCache extends Context.Tag(
  '@grepai/core/domain/embedding-cache/EmbeddingCache',
)<
  EmbeddingCache,
  {
    get: (
      key: EmbeddingKey,
    ) => Effect.Effect<string | undefined, EmbeddingCacheError, never>

    getMany: (keys: Array.NonEmptyReadonlyArray<EmbeddingKey>) => Effect.Effect<
      Array.NonEmptyReadonlyArray<{
        hash: string
        chunk: string
        embedding: string | undefined
      }>,
      EmbeddingCacheError,
      never
    >

    set: (
      key: EmbeddingKey,
      embedding: string,
    ) => Effect.Effect<void, EmbeddingCacheError, never>

    hash: (key: EmbeddingKey) => string
  }
>() {}
