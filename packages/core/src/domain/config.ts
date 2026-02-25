import * as Context from 'effect/Context'
import * as Schema from 'effect/Schema'

export class Config extends Context.Tag('@grepai/core/domain/config/Config')<
  Config,
  GrepAiConfig
>() {}

const StorageTurso = Schema.Struct({
  type: Schema.Literal('turso').pipe(
    Schema.annotations({
      description: 'Turso database storage backend',
    }),
  ),
  authToken: Schema.String.pipe(
    Schema.annotations({
      description: 'Authentication token for the Turso database',
    }),
  ),
  url: Schema.String.pipe(
    Schema.annotations({
      description: 'Connection URL of the Turso database',
    }),
  ),
})
const StoragePostgres = Schema.Struct({
  type: Schema.Literal('postgres').pipe(
    Schema.annotations({
      description: 'PostgreSQL database storage backend',
    }),
  ),
  connectionString: Schema.String.pipe(
    Schema.annotations({
      description:
        'PostgreSQL connection string (e.g. postgres://user:pass@host:port/db)',
    }),
  ),
})
const StorageLanceDb = Schema.Struct({
  type: Schema.Literal('lancedb').pipe(
    Schema.annotations({
      description: 'Local LanceDB storage backend',
    }),
  ),
})
const Storage = Schema.Union(StorageTurso, StoragePostgres, StorageLanceDb)

const EmbeddingBase = Schema.Struct({
  targetChunkSize: Schema.Number.pipe(
    Schema.annotations({
      description:
        'Preferred token count per chunk; adjacent chunks below this are merged',
    }),
    Schema.optional,
    Schema.withDecodingDefault(() => 256),
  ),
  maxChunkSize: Schema.Number.pipe(
    Schema.annotations({
      description:
        'Hard upper limit in tokens; AST nodes exceeding this are split recursively',
    }),
    Schema.optional,
    Schema.withDecodingDefault(() => 1024),
  ),
})
const EmbeddingGeminiEmbedding001 = Schema.Struct({
  ...EmbeddingBase.fields,
  provider: Schema.Literal('google'),
  model: Schema.Literal('gemini-embedding-001'),
  apiKey: Schema.String,
  dimensions: Schema.Literal(768, 1536, 3072).pipe(
    Schema.annotations({
      description:
        'Dimensionality of the embedding vectors (default 3072, capped to 1536 for Postgres)',
    }),
    Schema.optional,
    Schema.withDecodingDefault(() => 3072 as const),
  ),
  tokenizer: Schema.Literal('simple', 'gemini-embedding-001').pipe(
    Schema.optional,
    Schema.withDecodingDefault(() => 'gemini-embedding-001' as const),
  ),
})
const EmbeddingTextEmbedding3Small = Schema.Struct({
  ...EmbeddingBase.fields,
  provider: Schema.Literal('openai'),
  model: Schema.Literal('text-embedding-3-small'),
  apiKey: Schema.String,
  dimensions: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 1536),
    Schema.annotations({
      description: 'Dimensionality of the embedding vectors (max 1536)',
    }),
    Schema.optional,
    Schema.withDecodingDefault(() => 1536 as const),
  ),
  tokenizer: Schema.Literal('simple', 'tiktoken').pipe(
    Schema.optional,
    Schema.withDecodingDefault(() => 'tiktoken' as const),
  ),
})
const EmbeddingTextEmbedding3Large = Schema.Struct({
  ...EmbeddingBase.fields,
  provider: Schema.Literal('openai'),
  model: Schema.Literal('text-embedding-3-large'),
  apiKey: Schema.String,
  dimensions: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 3072),
    Schema.annotations({
      description: 'Dimensionality of the embedding vectors (max 3072)',
    }),
    Schema.optional,
    Schema.withDecodingDefault(() => 3072 as const),
  ),
  tokenizer: Schema.Literal('simple', 'tiktoken').pipe(
    Schema.optional,
    Schema.withDecodingDefault(() => 'tiktoken' as const),
  ),
})

const Embedding = Schema.Union(
  EmbeddingGeminiEmbedding001,
  EmbeddingTextEmbedding3Small,
  EmbeddingTextEmbedding3Large,
)

export const GrepAiConfig = Schema.Struct({
  $schema: Schema.String.pipe(Schema.optional),
  embedding: Embedding.pipe(
    Schema.annotations({
      description: 'Embedding model and provider configuration',
    }),
  ),
  include: Schema.Array(Schema.String).pipe(
    Schema.annotations({
      description: 'Glob patterns of files to index',
    }),
    Schema.optional,
    Schema.withDecodingDefault(() => []),
  ),
  exclude: Schema.Array(Schema.String).pipe(
    Schema.annotations({
      description: 'Glob patterns of files to exclude',
    }),
    Schema.optional,
    Schema.withDecodingDefault(() => []),
  ),
  storage: Storage.pipe(
    Schema.annotations({
      description: 'Database backend for storing chunks and embeddings',
    }),
  ),
  experimental__agentFs: Schema.Struct({
    syncMode: Schema.Literal('push', 'pull').pipe(
      Schema.optional,
      Schema.withDecodingDefault(() => 'pull'),
    ),
    url: Schema.String,
    authToken: Schema.String,
  }).pipe(Schema.optional),
})
export type GrepAiConfig = typeof GrepAiConfig.Type & {
  cwd: string
}
