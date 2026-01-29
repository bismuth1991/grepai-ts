import type { Embedding } from './embedding'
import type * as Array from 'effect/Array'

import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import { SchemaValidationFailed, VercelAiError } from './errors'

export class Embedder extends Context.Tag('@grepai/core/domain/embedder')<
  Embedder,
  {
    embedMany: (
      content: Array.NonEmptyReadonlyArray<string>,
    ) => Effect.Effect<
      Array.NonEmptyReadonlyArray<Embedding>,
      VercelAiError | SchemaValidationFailed,
      never
    >
  }
>() {}
