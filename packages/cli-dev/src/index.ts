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
        const filesCleaned = yield* SynchronizedRef.make(0)
        const filesIndexed = yield* SynchronizedRef.make(0)

        yield* grepAi.index({
          onStarted: () => clack.intro('GREP AI - INDEX CODEBASE'),
          onCodebaseScanned: (result) =>
            clack
              .note(
                [
                  `New     : ${result.new.length} files`,
                  `Modified: ${result.modified.length} files`,
                  `Unchaged: ${result.unchanged.length} files`,
                  `Deleted : ${result.deleted.length} files`,
                ].join('\n'),
                'Codebase scanned',
              )
              .pipe(Effect.zipRight(clack.spinner.start('Starting'))),
          onFileCleaned: ({ filePath, fileCount }) => {
            return SynchronizedRef.updateAndGetEffect(filesCleaned, (n) =>
              Effect.succeed(n + 1),
            ).pipe(
              Effect.tap((filesCleaned) =>
                clack.spinner.message(
                  `Cleaning: ${filesCleaned}/${fileCount} ${filePath}`,
                ),
              ),
            )
          },
          onFileIndexed: ({ filePath, fileCount }) => {
            return SynchronizedRef.updateAndGetEffect(filesIndexed, (n) =>
              Effect.succeed(n + 1),
            ).pipe(
              Effect.tap((filesIndexed) =>
                clack.spinner.message(
                  `Indexing: ${filesIndexed}/${fileCount} ${filePath}`,
                ),
              ),
            )
          },
          onFinished: () =>
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
    Command.withHandler(
      Effect.fnUntraced(function* (input) {
        const files = yield* grepAi.search(input)

        function mergeRanges(ranges: typeof files): string {
          return [...ranges]
            .sort((a, b) => a.startLine - b.startLine)
            .reduce<[number, number][]>((acc, { startLine, endLine }) => {
              const prev = acc.at(-1)
              if (prev && startLine <= prev[1]) {
                prev[1] = Math.max(prev[1], endLine)
              } else {
                acc.push([startLine, endLine])
              }
              return acc
            }, [])
            .map(([s, e]) => `${s}-${e}`)
            .join(', ')
        }
        function compactFileRanges(ranges: typeof files): string {
          const grouped = Map.groupBy(ranges, (r) => r.filePath)

          return [...grouped.entries()]
            .map(([file, rs]) => `${file}: ${mergeRanges(rs!)}`)
            .join('\n')
        }

        yield* Console.log(compactFileRanges(files))
      }),
    ),
  )

  const command = Command.make('grepai').pipe(
    Command.withSubcommands([indexCommand, searchCommand]),
  )

  const cli = Command.run(command, {
    name: 'GREP AI',
    version: 'v0.4.1',
  })

  yield* cli(process.argv)
})

program.pipe(
  Effect.provide(
    Layer.mergeAll(GrepAi.Default).pipe(
      Layer.provideMerge(Clack.Default),
      Layer.provideMerge(BunContext.layer),
    ),
  ),
  BunRuntime.runMain,
)
