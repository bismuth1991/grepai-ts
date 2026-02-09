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
const StoragePostgres = Schema.Struct({
  type: Schema.Literal('postgres'),
  connectionString: Schema.String,
})
const Storage = Schema.Union(StorageTurso, StoragePostgres)

const EmbeddingGoogle = Schema.Struct({
  provider: Schema.Literal('google'),
  model: Schema.Literal('gemini-embedding-001'),
  apiKey: Schema.String,
  dimensions: Schema.Literal(768, 1536, 3072),
  targetChunkSize: Schema.Number.pipe(
    Schema.optional,
    Schema.withDecodingDefault(() => 256),
  ),
  maxChunkSize: Schema.Number.pipe(
    Schema.optional,
    Schema.withDecodingDefault(() => 1024),
  ),
  embeddingBatchSize: Schema.Number.pipe(
    Schema.optional,
    Schema.withDecodingDefault(() => 100),
  ),
  tokenizer: Schema.Literal('simple', 'gemini-embedding-001').pipe(
    Schema.optional,
    Schema.withDecodingDefault(() => 'gemini-embedding-001'),
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
type GrepAiConfig = typeof GrepAiConfig.Type & {
  cwd: string
}
