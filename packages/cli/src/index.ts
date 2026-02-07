import { Args, Command, Options } from '@effect/cli'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { GrepAi } from '@grepai/core'
import * as Console from 'effect/Console'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as SynchronizedRef from 'effect/SynchronizedRef'

import { Clack } from './clack'

const program = Effect.gen(function* () {
  const grepAi = yield* GrepAi
  const clack = yield* Clack

  const indexCommand = Command.make('index').pipe(
    Command.withDescription('Index codebase for semantic search'),
    Command.withHandler(
      Effect.fnUntraced(function* () {
        const filesChunked = yield* SynchronizedRef.make(0)
        const chunkBatchesIndexed = yield* SynchronizedRef.make(0)

        yield* grepAi.index({
          onCodebaseIndexStarted: () =>
            clack
              .intro('GREP AI')
              .pipe(
                Effect.zipRight(clack.spinner.start('Scanning codebase...')),
              ),
          onCodebaseScanned: (result) =>
            clack.note(
              [
                `New     : ${result.new.length} files`,
                `Modified: ${result.modified.length} files`,
                `Unchaged: ${result.unchanged.length} files`,
                `Deleted : ${result.deleted.length} files`,
              ].join('\n'),
              'Codebase scanned',
            ),
          onFileChunked: ({ filePath, fileCount }) => {
            return SynchronizedRef.updateAndGetEffect(filesChunked, (n) =>
              Effect.succeed(n + 1),
            ).pipe(
              Effect.tap((filesChunked) =>
                clack.spinner.message(
                  `Chunking files: ${filesChunked}/${fileCount} ${filePath}`,
                ),
              ),
            )
          },
          onChunkBatchProcessed: (chunkCount) => {
            return SynchronizedRef.updateAndGetEffect(
              chunkBatchesIndexed,
              (n) => Effect.succeed(n + 1),
            ).pipe(
              Effect.map((chunkBatchesIndexed) =>
                Math.min(
                  chunkBatchesIndexed *
                    grepAi.config.embedding.embeddingBatchSize,
                  chunkCount,
                ),
              ),
              Effect.tap((chunksIndexed) =>
                clack.spinner.message(
                  `Indexing: ${chunksIndexed}/${chunkCount}`,
                ),
              ),
            )
          },
          onCodebaseIndexFinished: () =>
            clack.spinner
              .stop('Codebase indexed')
              .pipe(Effect.zipRight(clack.outro('DONE!'))),
        })
      }),
    ),
  )
  const searchCommand = Command.make('search', {
    query: Args.text({ name: 'query' }).pipe(
      Args.withDescription('Natural language query'),
    ),
    topK: Options.integer('topK').pipe(
      Options.withAlias('k'),
      Options.withDefault(20),
      Options.withDescription('Number of results to return'),
    ),
  }).pipe(
    Command.withDescription('Search code using natural language queries'),
    Command.withHandler((input) =>
      grepAi.search(input).pipe(Effect.tap(Console.log)),
    ),
  )

  const command = Command.make('grepai').pipe(
    Command.withSubcommands([indexCommand, searchCommand]),
  )

  const cli = Command.run(command, {
    name: 'GREP AI',
    version: 'v0.2.17',
  })

  yield* cli(process.argv)
})

program.pipe(
  Effect.provide(
    GrepAi.Default.pipe(
      Layer.provideMerge(Clack.Default),
      Layer.provideMerge(BunContext.layer),
    ),
  ),
  BunRuntime.runMain,
)
