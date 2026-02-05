import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import { TokenCounterCacheError } from './errors'

export class TokenCounterCache extends Context.Tag(
  '@grepai/core/domain/token-counter-cache/TokenCounterCache',
)<
  TokenCounterCache,
  {
    get: (key: {
      chunkHash: string
      tokenizer: string
    }) => Effect.Effect<number | undefined, TokenCounterCacheError, never>

    set: (
      key: {
        chunkHash: string
        tokenizer: string
      },
      tokenCount: number,
    ) => Effect.Effect<void, TokenCounterCacheError, never>
  }
>() {}
