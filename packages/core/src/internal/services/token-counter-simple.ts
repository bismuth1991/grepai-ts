import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { TokenCounter } from '../../domain/token-counter'

export const TokenCounterSimple = Layer.sync(TokenCounter, () => ({
  count: (text: string) => Effect.succeed(Math.ceil(text.length / 4)),
}))
