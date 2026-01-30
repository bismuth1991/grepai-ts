import * as Context from 'effect/Context'
import * as Schema from 'effect/Schema'

export class Config extends Context.Tag('@grepai/core/domain/config/Config')<
  Config,
  GrepAiConfig
>() {}

const StorageTurso = Schema.Struct({
  type: Schema.Literal('turso'),
  authToken: Schema.String,
  url: Schema.String,
})
const Storage = Schema.Union(StorageTurso)

const EmbeddingGoogle = Schema.Struct({
  provider: Schema.Literal('google'),
  model: Schema.Literal('gemini-embedding-001', 'text-embedding-004'),
  apiKey: Schema.String,
  maxChunkSize: Schema.Number.pipe(
    Schema.optional,
    Schema.withDecodingDefault(() => 1536),
  ),
  chunkOverlap: Schema.Number.pipe(
    Schema.optional,
    Schema.withDecodingDefault(() => 192),
  ),
})
const Embedding = Schema.Union(EmbeddingGoogle)

export const GrepAiConfig = Schema.Struct({
  $schema: Schema.String.pipe(Schema.optional),
  embedding: Embedding,
  include: Schema.Array(Schema.String).pipe(
    Schema.optional,
    Schema.withDecodingDefault(() => []),
  ),
  exclude: Schema.Array(Schema.String).pipe(
    Schema.optional,
    Schema.withDecodingDefault(() => []),
  ),
  storage: Storage,
})
export type GrepAiConfig = typeof GrepAiConfig.Type
