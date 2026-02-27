import { Args, Command, Options } from '@effect/cli'
import { GrepAi } from '@grepai/core'
import * as Console from 'effect/Console'
import * as Effect from 'effect/Effect'

import * as CommandRuntime from '../command-runtime'
import { ProjectScanner } from '../services/project-scanner'

export const GlobCommand = Effect.gen(function* () {
  const projectScanner = yield* ProjectScanner
  const projects = yield* projectScanner.scan()

  return Command.make('glob', {
    pattern: Args.text({ name: 'pattern' }).pipe(
      Args.withDescription('Glob pattern to match files (e.g. "src/**/*.ts")'),
    ),
    project: Options.choice('project', projects).pipe(
      Options.withAlias('p'),
      Options.withDescription('Project name'),
      Options.withDefault('default'),
    ),
  }).pipe(
    Command.withDescription('List indexed files matching a glob pattern'),
    Command.withHandler(
      Effect.fnUntraced(
        function* ({ pattern }) {
          const grepAi = yield* GrepAi

          const files = yield* grepAi.glob({ pattern })
          yield* Console.log(files.join('\n'))
        },
        (effect, { project }) =>
          effect.pipe(Effect.provide(CommandRuntime.layer(project))),
      ),
    ),
  )
})
