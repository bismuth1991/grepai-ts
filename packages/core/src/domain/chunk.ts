import * as Effect from 'effect/Effect'
import * as ParseResult from 'effect/ParseResult'
import * as Schema from 'effect/Schema'

const ChunkVector = Schema.transformOrFail(
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

export const Chunk = Schema.Struct({
  id: Schema.Number,
  chunkId: Schema.String,
  filePath: Schema.String,
  startLine: Schema.Number,
  endLine: Schema.Number,
  content: Schema.String,
  vector: ChunkVector,
  hash: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
})
export type Chunk = typeof Chunk.Type

export const ChunkInsertInput = Chunk.pipe(
  Schema.omit('id', 'createdAt', 'updatedAt'),
)
export type ChunkInsertInput = typeof ChunkInsertInput.Encoded
