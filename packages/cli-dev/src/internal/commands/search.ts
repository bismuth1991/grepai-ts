import { Args, Command, Options } from '@effect/cli'
import { GrepAi } from '@grepai/core'
import * as Console from 'effect/Console'
import * as Effect from 'effect/Effect'

import * as CommandRuntime from '../command-runtime'
import { CommandUtils } from '../services/command-utils'
import { ProjectScanner } from '../services/project-scanner'

export const SearchCommand = Effect.gen(function* () {
  const projectScanner = yield* ProjectScanner
  const projects = yield* projectScanner.scan()

  return Command.make('search', {
    query: Args.text({ name: 'query' }).pipe(
      Args.withDescription('Natural language query'),
    ),
    topK: Options.integer('topK').pipe(
      Options.withAlias('k'),
      Options.withDefault(20),
      Options.withDescription('Number of results to return'),
    ),
    project: Options.choice('project', projects).pipe(
      Options.withAlias('p'),
      Options.withDescription('Project name'),
      Options.withDefault('default'),
    ),
  }).pipe(
    Command.withDescription('Search code using natural language queries'),
    Command.withHandler(
      Effect.fnUntraced(
        function* (input) {
          const grepAi = yield* GrepAi
          const commandUtils = yield* CommandUtils

          const files = yield* grepAi.search(input)
          yield* Console.log(commandUtils.compactFileRanges(files))
        },
        (effect, { project }) =>
          effect.pipe(Effect.provide(CommandRuntime.layer(project))),
      ),
    ),
  )
})
