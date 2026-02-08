import type { EmbedQueryType } from '../../domain/embedder'

import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import { Config } from '../../domain/config'
import { Embedder } from '../../domain/embedder'
import { Embedding } from '../../domain/embedding'
import { SchemaValidationFailed } from '../../domain/errors'

import { VercelAi } from './vercel-ai'

export const EmbedderGemini = Layer.effect(
  Embedder,
  Effect.gen(function* () {
    const ai = yield* VercelAi
    const config = yield* Config

    const embedMany = Effect.fnUntraced(
      function* (textChunks: Array.NonEmptyReadonlyArray<string>) {
        const taskType = 'RETRIEVAL_DOCUMENT'
        const dimensions = config.embedding.dimensions
        const embedder = config.embedding.model

        return yield* ai
          .use(({ embedMany: embed, google }) =>
            embed({
              model: google.embedding(embedder),
              values: Array.fromIterable(textChunks),
              providerOptions: {
                google: {
                  taskType,
                  outputDimensionality: dimensions,
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
        const embedder = config.embedding.model
        const dimensions = config.embedding.dimensions
        const taskType =
          type === 'code-retrieval' ? 'CODE_RETRIEVAL_QUERY' : 'RETRIEVAL_QUERY'

        return yield* ai
          .use(({ embedMany: embed, google }) =>
            embed({
              model: google.embedding(embedder),
              values: [query],
              providerOptions: {
                google: {
                  taskType,
                  outputDimensionality: dimensions,
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
