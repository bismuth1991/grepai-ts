import { FetchHttpClient, FileSystem, Path } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { Chunker } from '../../domain/chunker'
import { ChunkerAst } from '../services/chunker-ast'
import { AstParser } from '../services/chunker-ast/ast-parser'
import { ContextHeaderBuilder } from '../services/chunker-ast/context-header-builder'
import { ConfigJson } from '../services/config-json'
import { TokenCounterGemini } from '../services/token-counter-gemini'

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const chunker = yield* Chunker

  const filePath = path.resolve(
    import.meta.dirname,
    '../services/chunk-storage-sql.ts',
  )
  const content = yield* fs.readFileString(filePath)

  yield* chunker
    .chunk({ filePath, content, language: 'typescript' })
    .pipe(
      Effect.tap((chunks) =>
        Effect.logInfo(
          chunks.map((chunk) => chunk.content).join('\n\n---\n\n'),
        ),
      ),
    )
})

program.pipe(
  Effect.provide(
    ChunkerAst.pipe(
      Layer.provide(AstParser.Default),
      Layer.provide(ContextHeaderBuilder.Default),
      Layer.provide(
        TokenCounterGemini.pipe(Layer.provide(FetchHttpClient.layer)),
      ),
      Layer.provideMerge(ConfigJson),
      Layer.provideMerge(BunContext.layer),
    ),
  ),
  BunRuntime.runMain,
)
