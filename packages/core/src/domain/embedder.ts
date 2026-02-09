import type { Embedding } from './embedding'
import type { SchemaValidationFailed, VercelAiError } from './errors'
import type * as Array from 'effect/Array'

import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

export type EmbedQueryType = 'code-retrieval' | 'retrieval'

export class Embedder extends Context.Tag('@grepai/core/domain/embedder')<
  Embedder,
  {
    embed: (
      textChunk: string,
    ) => Effect.Effect<Embedding, VercelAiError | SchemaValidationFailed, never>

    embedMany: (
      textChunks: Array.NonEmptyReadonlyArray<string>,
    ) => Effect.Effect<
      Array.NonEmptyReadonlyArray<Embedding>,
      VercelAiError | SchemaValidationFailed,
      never
    >

    embedQuery: (
      query: string,
      type?: EmbedQueryType,
    ) => Effect.Effect<Embedding, VercelAiError | SchemaValidationFailed, never>
  }
>() {}
