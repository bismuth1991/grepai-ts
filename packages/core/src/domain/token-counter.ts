import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import { TokenCounterError } from './errors'

export class TokenCounter extends Context.Tag(
  '@grepai/core/domain/token-counter/TokenCounter',
)<
  TokenCounter,
  {
    count: (content: string) => Effect.Effect<number, TokenCounterError, never>
  }
>() {}
