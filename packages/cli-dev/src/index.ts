import { Command } from '@effect/cli'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { IndexCommand } from './internal/commands'
import { GlobCommand } from './internal/commands/glob'
import { GrepCommand } from './internal/commands/grep'
import { ReadCommand } from './internal/commands/read'
import { SearchCommand } from './internal/commands/search'
import { ProjectScanner } from './internal/services/project-scanner'

const program = Effect.gen(function* () {
  const subcommands = yield* Effect.all([
    IndexCommand,
    GlobCommand,
    GrepCommand,
    ReadCommand,
    SearchCommand,
  ])

  const command = Command.make('grepai').pipe(
    Command.withSubcommands(subcommands),
  )

  const cli = Command.run(command, {
    name: 'GREP AI',
    version: 'v0.8.2',
  })

  yield* cli(process.argv)
})

program.pipe(
  Effect.provide(
    ProjectScanner.Default.pipe(Layer.provideMerge(BunContext.layer)),
  ),
  BunRuntime.runMain,
)
