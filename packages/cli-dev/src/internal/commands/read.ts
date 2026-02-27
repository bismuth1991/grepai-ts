import { Args, Command, Options } from '@effect/cli'
import { GrepAi } from '@grepai/core'
import * as Console from 'effect/Console'
import * as Effect from 'effect/Effect'

import * as CommandRuntime from '../command-runtime'
import { ProjectScanner } from '../services/project-scanner'

export const ReadCommand = Effect.gen(function* () {
  const projectScanner = yield* ProjectScanner
  const projects = yield* projectScanner.scan()

  return Command.make('read', {
    filePath: Args.text({ name: 'filePath' }).pipe(
      Args.withDescription('Path to the file to read'),
    ),
    offset: Options.integer('offset').pipe(
      Options.withDefault(1),
      Options.withDescription('Starting line number (1-indexed)'),
    ),
    limit: Options.integer('limit').pipe(
      Options.withDefault(2000),
      Options.withDescription('Maximum number of lines to read'),
    ),
    project: Options.choice('project', projects).pipe(
      Options.withAlias('p'),
      Options.withDescription('Project name'),
      Options.withDefault('default'),
    ),
  }).pipe(
    Command.withDescription('Read a file with line numbers'),
    Command.withHandler(
      Effect.fnUntraced(
        function* ({ filePath, offset, limit }) {
          const grepAi = yield* GrepAi

          const content = yield* grepAi.read({
            filePath,
            offset,
            limit,
          })
          yield* Console.log(content)
        },
        (effect, { project }) =>
          effect.pipe(Effect.provide(CommandRuntime.layer(project))),
      ),
    ),
  )
})
