import * as Effect from 'effect/Effect'
import * as ParseResult from 'effect/ParseResult'
import * as Schema from 'effect/Schema'

export const Embedding = Schema.transformOrFail(
  Schema.Union(Schema.NonEmptyArray(Schema.Number), Schema.String),
  Schema.String,
  {
    strict: true,
    decode: (input, _, ast) => {
      if (typeof input === 'string') {
        return Effect.succeed(input).pipe(
          Effect.flatMap(
            Schema.decodeUnknown(
              Schema.parseJson(Schema.NonEmptyArray(Schema.Number)),
            ),
          ),
          Effect.map(JSON.stringify),
          Effect.catchTags({
            ParseError: () =>
              ParseResult.fail(
                new ParseResult.Type(
                  ast,
                  input,
                  'Invalid JSON, expecting json-stringified representation of a non-empty array of numbers',
                ),
              ),
          }),
        )
      }
      return Effect.succeed(JSON.stringify(input))
    },
    encode: (input) => Effect.succeed(input),
  },
)
export type Embedding = typeof Embedding.Type

export const EmbeddingA = Schema.transformOrFail(
  Schema.Union(Schema.NonEmptyArray(Schema.Number), Schema.String),
  Schema.NonEmptyArray(Schema.Number),
  {
    strict: true,
    decode: (input, _, ast) => {
      if (typeof input === 'string') {
        return Effect.succeed(input).pipe(
          Effect.flatMap(
            Schema.decodeUnknown(
              Schema.parseJson(Schema.NonEmptyArray(Schema.Number)),
            ),
          ),
          Effect.catchTags({
            ParseError: () =>
              ParseResult.fail(
                new ParseResult.Type(
                  ast,
                  input,
                  'Invalid JSON, expecting json-stringified representation of a non-empty array of numbers',
                ),
              ),
          }),
        )
      }
      return Effect.succeed(input)
    },
    encode: (input) => Effect.succeed(input),
  },
)
