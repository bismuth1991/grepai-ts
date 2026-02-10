import type { EmbedQueryType } from '../../domain/embedder'

import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import { Config } from '../../domain/config'
import { Embedder } from '../../domain/embedder'
import { Embedding } from '../../domain/embedding'
import { SchemaValidationFailed } from '../../domain/errors'

import { EmbeddingNormalizer } from './embedding-normalizer'
import { VercelAi } from './vercel-ai'

export const EmbedderGemini = Layer.effect(
  Embedder,
  Effect.gen(function* () {
    const ai = yield* VercelAi
    const config = yield* Config
    const normalizer = yield* EmbeddingNormalizer

    const getDimensions = () =>
      config.storage.type === 'postgres'
        ? Math.min(1536, config.embedding.dimensions)
        : config.embedding.dimensions

    const embed = Effect.fnUntraced(
      function* (textChunk: string) {
        const taskType = 'RETRIEVAL_DOCUMENT'
        const embedder = config.embedding.model
        const dimensions = getDimensions()

        return yield* ai
          .use(({ embed: _embed, google }) =>
            _embed({
              model: google.embedding(embedder),
              value: textChunk,
              providerOptions: {
                google: {
                  taskType,
                  outputDimensionality: dimensions,
                },
              },
            }),
          )
          .pipe(
            Effect.map(({ embedding }) =>
              config.embedding.dimensions !== 3072
                ? normalizer.normalize(embedding).normalized
                : embedding,
            ),
            Effect.flatMap(Schema.decodeUnknown(Embedding)),
          )
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
      }),
    )

    const embedMany = Effect.fnUntraced(
      function* (textChunks: Array.NonEmptyReadonlyArray<string>) {
        const taskType = 'RETRIEVAL_DOCUMENT'
        const embedder = config.embedding.model
        const dimensions = getDimensions()

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
        const dimensions = getDimensions()
        const taskType =
          type === 'code-retrieval' ? 'CODE_RETRIEVAL_QUERY' : 'RETRIEVAL_QUERY'

        return yield* ai
          .use(({ embed, google }) =>
            embed({
              model: google.embedding(embedder),
              value: query,
              providerOptions: {
                google: {
                  taskType,
                  outputDimensionality: dimensions,
                },
              },
            }),
          )
          .pipe(
            Effect.map(({ embedding }) => embedding),
            Effect.flatMap(Schema.decodeUnknown(Embedding)),
          )
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
      }),
    )

    return Embedder.of({
      embed,
      embedMany,
      embedQuery,
    })
  }),
)
