import { Args, Command, Options } from '@effect/cli'
import { GrepAi } from '@grepai/core'
import * as Console from 'effect/Console'
import * as Effect from 'effect/Effect'

import * as CommandRuntime from '../command-runtime'
import { CommandUtils } from '../services/command-utils'
import { ProjectScanner } from '../services/project-scanner'

export const GrepCommand = Effect.gen(function* () {
  const projectScanner = yield* ProjectScanner
  const projects = yield* projectScanner.scan()

  return Command.make('grep', {
    pattern: Args.text({ name: 'pattern' }).pipe(
      Args.withDescription('Text pattern to search in indexed chunks'),
    ),
    limit: Options.integer('limit').pipe(
      Options.withAlias('l'),
      Options.withDefault(100),
      Options.withDescription(
        'Maximum number of results to return, default 100',
      ),
    ),
    project: Options.choice('project', projects).pipe(
      Options.withAlias('p'),
      Options.withDescription('Project name'),
      Options.withDefault('default'),
    ),
  }).pipe(
    Command.withDescription('Search indexed code chunks for a text pattern'),
    Command.withHandler(
      Effect.fnUntraced(
        function* ({ pattern, limit }) {
          const grepAi = yield* GrepAi
          const commandUtils = yield* CommandUtils

          const results = yield* grepAi.grep({
            pattern,
            limit,
          })
          yield* Console.log(commandUtils.compactFileRanges(results))
        },
        (effect, { project }) =>
          effect.pipe(Effect.provide(CommandRuntime.layer(project))),
      ),
    ),
  )
})
