import { FetchHttpClient } from '@effect/platform'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'

import { ChunkStorage } from '../../domain/chunk-storage'
import { DocumentStorage } from '../../domain/document-storage'
import { Config } from '../../domain/config'

import { ChunkStorageLanceDb } from './chunk-storage-lancedb'
import { ChunkStorageSql } from './chunk-storage-sql'
import { ChunkerAst } from './chunker-ast'
import { CodebaseScannerAgentFs } from './codebase-scanner-agentfs'
import { CodebaseScannerFs } from './codebase-scanner-fs'
import { ConfigJson } from './config-json'
import { DocumentStorageLanceDb } from './document-storage-lancedb'
import { DocumentStorageSql } from './document-storage-sql'
import { EmbedderGemini } from './embedder-gemini'
import { EmbedderOpenai } from './embedder-openai'
import { EmbeddingNormalizer } from './embedding-normalizer'
import { FileIndexer } from './file-indexer'
import { Indexer } from './indexer'
import { LanceDbLive } from './lancedb'
import { LibsqlLive, PgLive } from './sql'
import { TokenCounterGemini } from './token-counter-gemini'
import { TokenCounterSimple } from './token-counter-simple'
import { TokenCounterTiktoken } from './token-counter-tiktoken'
import { VercelAi } from './vercel-ai'

const GrepAiLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* Config

    const StorageSqlLiveLazy = () =>
      Match.value(config.storage.type).pipe(
        Match.when('turso', () => LibsqlLive),
        Match.when('postgres', () => PgLive),
        Match.orElseAbsurd,
      )
    const StorageLanceDbLiveLazy = () =>
      Match.value(config.storage.type).pipe(
        Match.when('lancedb', () => LanceDbLive),
        Match.orElseAbsurd,
      )
    const EmbedderLive = Match.value(config.embedding.provider).pipe(
      Match.when('google', () => EmbedderGemini),
      Match.when('openai', () => EmbedderOpenai),
      Match.exhaustive,
    )
    const TokenCounterLive = Match.value(config.embedding.tokenizer).pipe(
      Match.when('simple', () => TokenCounterSimple),
      Match.when('gemini-embedding-001', () => TokenCounterGemini),
      Match.when('tiktoken', () => TokenCounterTiktoken),
      Match.exhaustive,
    )
    const DocumentStorageLive = Match.value(config.storage.type).pipe(
      Match.when('turso', () =>
        DocumentStorageSql.pipe(Layer.provide(StorageSqlLiveLazy())),
      ),
      Match.when('postgres', () =>
        DocumentStorageSql.pipe(Layer.provide(StorageSqlLiveLazy())),
      ),
      Match.when('lancedb', () =>
        DocumentStorageLanceDb.pipe(Layer.provide(StorageLanceDbLiveLazy())),
      ),
      Match.exhaustive,
    )
    const ChunkStorageLive = Match.value(config.storage.type).pipe(
      Match.when('turso', () =>
        ChunkStorageSql.pipe(Layer.provide(StorageSqlLiveLazy())),
      ),
      Match.when('postgres', () =>
        ChunkStorageSql.pipe(Layer.provide(StorageSqlLiveLazy())),
      ),
      Match.when('lancedb', () =>
        ChunkStorageLanceDb.pipe(Layer.provide(StorageLanceDbLiveLazy())),
      ),
      Match.exhaustive,
    )
    const FileIndexerLive = Match.value(config.storage.type).pipe(
      Match.when('turso', () =>
        FileIndexer.Default.pipe(Layer.provide(StorageSqlLiveLazy())),
      ),
      Match.when('postgres', () =>
        FileIndexer.Default.pipe(Layer.provide(StorageSqlLiveLazy())),
      ),
      Match.when('lancedb', () => FileIndexer.Default),
      Match.exhaustive,
    )

    const CodebaseScannerLive = Match.value(config.experimental__agentFs).pipe(
      Match.when(
        (val) => !!val,
        () => CodebaseScannerAgentFs,
      ),
      Match.orElse(() => CodebaseScannerFs),
    )

    return Indexer.Default.pipe(
      Layer.provide(FileIndexerLive),
      Layer.provideMerge(ChunkStorageLive),
      Layer.provide(CodebaseScannerLive),
      Layer.provide(ChunkerAst),
      Layer.provide(
        TokenCounterLive.pipe(Layer.provide(FetchHttpClient.layer)),
      ),
      Layer.provide(
        EmbedderLive.pipe(
          Layer.provide(EmbeddingNormalizer.Default),
          Layer.provide(VercelAi.Default),
        ),
      ),
      Layer.provideMerge(DocumentStorageLive),
    )
  }),
).pipe(Layer.provideMerge(ConfigJson))

export class GrepAi extends Effect.Service<GrepAi>()(
  '@grepai/core/internal/services/grep-ai/GrepAi',
  {
    dependencies: [GrepAiLive],
    effect: Effect.gen(function* () {
      const config = yield* Config
      const indexer = yield* Indexer
      const chunkStorage = yield* ChunkStorage
      const documentStorage = yield* DocumentStorage

      return {
        search: chunkStorage.search,
        glob: documentStorage.glob,
        grep: chunkStorage.grep,
        index: indexer.index,
        config,
      } as const
    }),
  },
) {}
