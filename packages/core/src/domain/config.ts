import * as Context from 'effect/Context'
import * as Schema from 'effect/Schema'

export class ConfigProvider extends Context.Tag(
  '@grepai/core/domain/config-provider/ConfigProvider',
)<ConfigProvider, GrepAiConfig>() {}

const StorageTurso = Schema.Struct({
  authToken: Schema.String,
  url: Schema.String,
})
const Storage = Schema.Union(StorageTurso)

const EmbeddingGoogle = Schema.Struct({
  apiKey: Schema.String,
  model: Schema.Literal('gemini-embedding-001', 'text-embedding-004'),
  provider: Schema.Literal('google'),
})
const Embedding = Schema.Union(EmbeddingGoogle)

export const GrepAiConfig = Schema.Struct({
  chunking: Schema.Struct({
    overlap: Schema.Number.pipe(
      Schema.optional,
      Schema.withDecodingDefault(() => 50),
    ),
    size: Schema.Number.pipe(
      Schema.optional,
      Schema.withDecodingDefault(() => 512),
    ),
  }),
  embedding: Embedding,
  ignorePatterns: Schema.Array(Schema.String).pipe(
    Schema.optional,
    Schema.withDecodingDefault(() => []),
  ),
  search: Schema.Struct({
    boost: Schema.Struct({
      bonuses: Schema.Array(
        Schema.Struct({
          pattern: Schema.String,
          factor: Schema.Number,
        }),
      ).pipe(
        Schema.optional,
        Schema.withDecodingDefault(() => []),
      ),
      enabled: Schema.Boolean.pipe(
        Schema.optional,
        Schema.withDecodingDefault(() => true),
      ),
      penalties: Schema.Array(
        Schema.Struct({
          pattern: Schema.String,
          factor: Schema.Number,
        }),
      ).pipe(
        Schema.optional,
        Schema.withDecodingDefault(() => []),
      ),
    }),
    hybrid: Schema.Struct({
      enabled: Schema.Boolean.pipe(
        Schema.optional,
        Schema.withDecodingDefault(() => false),
      ),
      rrfK: Schema.Number.pipe(
        Schema.optional,
        Schema.withDecodingDefault(() => 60),
      ),
    }),
  }),
  storage: Storage,
  trace: Schema.Struct({
    enabledLanguages: Schema.Array(
      Schema.Literal('.js', '.jsx', '.ts', '.tsx'),
    ).pipe(
      Schema.optional,
      Schema.withDecodingDefault(() => ['.js', '.jsx', '.ts', '.tsx']),
    ),
    mode: Schema.Literal('fast', 'tree-sitter').pipe(
      Schema.optional,
      Schema.withDecodingDefault(() => 'fast'),
    ),
  }),
})
export type GrepAiConfig = typeof GrepAiConfig.Type
