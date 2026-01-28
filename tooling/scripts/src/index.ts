import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { Command } from '@effect/cli'
import { Git } from './internal/services/git'
import { VercelAi } from '@grepai/core/vercel-ai'
import { git } from './internal/git'

const program = Effect.gen(function* () {
  const gitCommand = yield* git

  const command = Command.make('cli').pipe(
    Command.withSubcommands([gitCommand]),
  )
  const cli = Command.run(command, {
    name: 'CLI',
    version: '1.0.0',
  })

  yield* cli(process.argv)
})

program.pipe(
  Effect.provide(
    Layer.mergeAll(Git.Default, VercelAi.Default).pipe(
      Layer.provideMerge(BunContext.layer),
    ),
  ),
  BunRuntime.runMain,
)
