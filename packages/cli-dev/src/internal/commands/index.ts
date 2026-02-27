import { Command, Options } from '@effect/cli'
import { GrepAi } from '@grepai/core'
import * as Effect from 'effect/Effect'
import * as SynchronizedRef from 'effect/SynchronizedRef'

import { Clack } from '../../clack'
import * as CommandRuntime from '../command-runtime'
import { ProjectScanner } from '../services/project-scanner'

export const IndexCommand = Effect.gen(function* () {
  const projectScanner = yield* ProjectScanner
  const projects = yield* projectScanner.scan()

  return Command.make('index', {
    project: Options.choice('project', projects).pipe(
      Options.withAlias('p'),
      Options.withDescription('Project name'),
      Options.withDefault('default'),
    ),
  }).pipe(
    Command.withDescription('Index codebase for semantic search'),
    Command.withHandler(
      Effect.fnUntraced(
        function* (_) {
          const clack = yield* Clack
          const grepAi = yield* GrepAi

          const filesCleaned = yield* SynchronizedRef.make(0)
          const filesIndexed = yield* SynchronizedRef.make(0)

          yield* grepAi.index({
            onStarted: () =>
              clack
                .intro('GREP AI - INDEX CODEBASE')
                .pipe(
                  Effect.zipRight(clack.spinner.start('Scanning codebase')),
                ),

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
                .pipe(Effect.zipRight(clack.spinner.message('Indexing'))),

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
        },
        (effect, { project }) =>
          effect.pipe(Effect.provide(CommandRuntime.layer(project))),
      ),
    ),
  )
})
