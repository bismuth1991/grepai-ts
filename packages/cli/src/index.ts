import { Command } from '@effect/cli'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { Indexer } from '@grepai/core'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

const program = Effect.gen(function* () {
  const indexer = yield* Indexer

  const indexCommand = Command.make('index').pipe(
    Command.withHandler(indexer.index),
  )
  const command = Command.make('grepai').pipe(
    Command.withSubcommands([indexCommand]),
  )

  const cli = Command.run(command, {
    name: 'GrepAi',
    version: '1.0.0',
  })

  yield* cli(process.argv)
})

program.pipe(
  Effect.provide(
    Layer.mergeAll(Indexer.Default).pipe(Layer.provideMerge(BunContext.layer)),
  ),
  BunRuntime.runMain,
)
