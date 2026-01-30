import type { EmbedQueryType } from '../../domain/embedder'

import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import { ConfigProvider } from '../../domain/config'
import { Embedder } from '../../domain/embedder'
import { Embedding } from '../../domain/embedding'
import { SchemaValidationFailed } from '../../domain/errors'

import { VercelAi } from './vercel-ai'

export const EmbedderGemini = Layer.effect(
  Embedder,
  Effect.gen(function* () {
    const ai = yield* VercelAi
    const config = yield* ConfigProvider

    const embedMany = Effect.fnUntraced(
      function* (textChunks: Array.NonEmptyReadonlyArray<string>) {
        return yield* ai
          .use(({ embedMany: embed, google }) =>
            embed({
              model: google.embedding(config.embedding.model),
              values: Array.fromIterable(textChunks),
              providerOptions: {
                google: {
                  taskType: 'RETRIEVAL_DOCUMENT',
                },
              },
            }),
          )
          .pipe(
            Effect.map(({ embeddings }) => embeddings),
            Effect.flatMap(
              Schema.decodeUnknown(Schema.NonEmptyArray(Embedding)),
            ),
          )
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
      }),
    )

    const embedQuery = Effect.fnUntraced(
      function* (query: string, type: EmbedQueryType = 'code-retrieval') {
        const taskType =
          type === 'code-retrieval' ? 'CODE_RETRIEVAL_QUERY' : 'RETRIEVAL_QUERY'

        return yield* ai
          .use(({ embedMany: embed, google }) =>
            embed({
              model: google.embedding(config.embedding.model),
              values: [query],
              providerOptions: {
                google: {
                  taskType,
                },
              },
            }),
          )
          .pipe(
            Effect.map(({ embeddings }) => embeddings),
            Effect.flatMap(
              Schema.decodeUnknown(Schema.NonEmptyArray(Embedding)),
            ),
            Effect.map(Array.headNonEmpty),
          )
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
      }),
    )

    return Embedder.of({
      embedMany,
      embedQuery,
    })
  }),
)
