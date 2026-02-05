import type { EmbedQueryType } from '../../domain/embedder'

import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Record from 'effect/Record'
import * as Schema from 'effect/Schema'

import { Config } from '../../domain/config'
import { Embedder } from '../../domain/embedder'
import { Embedding } from '../../domain/embedding'
import { EmbeddingCache } from '../../domain/embedding-cache'
import { SchemaValidationFailed } from '../../domain/errors'

import { VercelAi } from './vercel-ai'

export const EmbedderGemini = Layer.effect(
  Embedder,
  Effect.gen(function* () {
    const ai = yield* VercelAi
    const config = yield* Config
    const cache = yield* EmbeddingCache

    const embedMany = Effect.fnUntraced(
      function* (textChunks: Array.NonEmptyReadonlyArray<string>) {
        const taskType = 'RETRIEVAL_DOCUMENT'
        const dimensions = config.embedding.dimensions
        const embedder = config.embedding.model

        const cached = yield* cache.getMany(
          Array.map(textChunks, (chunk) => ({
            chunk,
            embedder,
            taskType,
            dimensions,
          })),
        )

        const cacheMisses = Array.filter(cached, ({ embedding }) => !embedding)

        const embeddingHashMap = yield* ai
          .use(({ embedMany: embed, google }) =>
            embed({
              model: google.embedding(embedder),
              values: Array.map(
                Array.fromIterable(cacheMisses),
                ({ chunk }) => chunk,
              ),
              providerOptions: {
                google: {
                  taskType,
                  outputDimensionality: dimensions,
                },
              },
            }),
          )
          .pipe(
            Effect.map(({ embeddings, values }) =>
              Array.map(values, (chunk, index) => ({
                hash: cache.hash({
                  chunk,
                  embedder,
                  taskType,
                  dimensions,
                }),
                chunk,
                embedding: embeddings[index]!,
              })),
            ),
            Effect.flatMap(
              Schema.decodeUnknown(
                Schema.NonEmptyArray(
                  Schema.Struct({
                    hash: Schema.String,
                    chunk: Schema.String,
                    embedding: Embedding,
                  }),
                ),
              ),
            ),
            Effect.tap(
              Effect.forEach(
                ({ chunk, embedding }) =>
                  cache.set(
                    { chunk, embedder, taskType, dimensions },
                    embedding,
                  ),
                { concurrency: 'unbounded' },
              ),
            ),
            Effect.map((embeddings) =>
              Record.fromIterableBy(embeddings, ({ hash }) => hash),
            ),
          )

        return Array.map(cached, ({ hash, embedding }) => {
          if (embedding) {
            return embedding
          }
          return embeddingHashMap[hash]!.embedding
        })
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

        const cached = yield* cache.get({
          chunk: query,
          embedder,
          taskType,
          dimensions,
        })

        if (cached) {
          return cached
        }

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
            Effect.tap((embedding) =>
              cache.set(
                {
                  chunk: query,
                  embedder,
                  taskType,
                  dimensions,
                },
                embedding,
              ),
            ),
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
