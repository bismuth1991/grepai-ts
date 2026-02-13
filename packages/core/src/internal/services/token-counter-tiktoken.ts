import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import { Tiktoken } from 'js-tiktoken/lite'
import cl100k_base from 'js-tiktoken/ranks/cl100k_base'

import { Config } from '../../domain/config'
import { TokenCounter } from '../../domain/token-counter'

export const TokenCounterTiktoken = Layer.effect(
  TokenCounter,
  Effect.gen(function* () {
    const config = yield* Config

    const encoder = Match.value(config.embedding.model).pipe(
      Match.when('text-embedding-3-small', () => new Tiktoken(cl100k_base)),
      Match.when('text-embedding-3-large', () => new Tiktoken(cl100k_base)),
      Match.orElseAbsurd,
    )

    return TokenCounter.of({
      count: (text) => Effect.succeed(encoder.encode(text).length),
    })
  }),
)
