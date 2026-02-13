import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import { Config } from '../../domain/config'
import { Embedder } from '../../domain/embedder'
import { Embedding } from '../../domain/embedding'
import { SchemaValidationFailed } from '../../domain/errors'

import { VercelAi } from './vercel-ai'

export const EmbedderOpenai = Layer.effect(
  Embedder,
  Effect.gen(function* () {
    const ai = yield* VercelAi
    const config = yield* Config

    const getDimensions = () =>
      config.storage.type === 'postgres'
        ? Math.min(1536, config.embedding.dimensions)
        : config.embedding.dimensions

    const embed = Effect.fnUntraced(
      function* (textChunk: string) {
        const embedder = config.embedding.model
        const dimensions = getDimensions()

        return yield* ai
          .use(({ embed: _embed, openai }) =>
            _embed({
              model: openai.embedding(embedder),
              value: textChunk,
              providerOptions: {
                openai: {
                  dimensions,
                },
              },
            }),
          )
          .pipe(Effect.flatMap(Schema.decodeUnknown(Embedding)))
      },
      Effect.catchTags({
        ParseError: (cause) => new SchemaValidationFailed({ cause }),
      }),
    )

    const embedMany = Effect.fnUntraced(
      function* (textChunks: Array.NonEmptyReadonlyArray<string>) {
        const dimensions = getDimensions()

        return yield* ai
          .use(({ embedMany: embed, openai }) =>
            embed({
              model: openai.embedding(config.embedding.model),
              values: Array.fromIterable(textChunks),
              providerOptions: {
                openai: {
                  dimensions,
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

    return Embedder.of({
      embed,
      embedMany,
      embedQuery: embed,
    })
  }),
)
