import { Args, Command, Options } from '@effect/cli'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { GrepAi } from '@grepai/core'
import * as Console from 'effect/Console'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

const program = Effect.gen(function* () {
  const grepAi = yield* GrepAi

  const indexCommand = Command.make('index').pipe(
    Command.withDescription('Index codebase for semantic search'),
    Command.withHandler(grepAi.index),
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
    name: 'GrepAi',
    version: '1.0.0',
  })

  yield* cli(process.argv)
})

program.pipe(
  Effect.provide(GrepAi.Default.pipe(Layer.provideMerge(BunContext.layer))),
  BunRuntime.runMain,
)
