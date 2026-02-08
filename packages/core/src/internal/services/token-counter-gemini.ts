import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from '@effect/platform'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import { Config } from '../../domain/config'
import { TokenCounterError } from '../../domain/errors'
import { TokenCounter } from '../../domain/token-counter'

export const TokenCounterGemini = Layer.effect(
  TokenCounter,
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient
    const config = yield* Config

    const count = Effect.fnUntraced(
      function* (text: string) {
        const tokenizer = 'gemini-embedding-001'

        const request = yield* HttpClientRequest.post(
          `/${tokenizer}:countTokens`,
        ).pipe(
          HttpClientRequest.prependUrl(
            'https://generativelanguage.googleapis.com/v1beta/models',
          ),
          HttpClientRequest.appendUrlParam('key', config.embedding.apiKey),
          HttpClientRequest.bodyJson({
            contents: [
              {
                role: 'user',
                parts: [{ text }],
              },
            ],
          }),
        )

        return yield* httpClient.execute(request).pipe(
          Effect.flatMap(
            HttpClientResponse.schemaBodyJson(
              Schema.Struct({
                totalTokens: Schema.Number,
              }),
            ),
          ),
          Effect.map(({ totalTokens }) => totalTokens),
        )
      },
      Effect.catchTags({
        HttpBodyError: (cause) => new TokenCounterError({ cause }),
        RequestError: (cause) => new TokenCounterError({ cause }),
        ResponseError: (cause) => new TokenCounterError({ cause }),
        ParseError: (cause) => new TokenCounterError({ cause }),
      }),
    )

    return TokenCounter.of({
      count,
    })
  }),
)
