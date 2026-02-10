import { Command, Path } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'

const program = Effect.gen(function* () {
  const path = yield* Path.Path

  yield* Command.make(
    'bunx',
    'tree-sitter',
    'build',
    '--wasm',
    '--output',
    path.resolve(
      import.meta.dirname,
      '../services/chunker-ast/tree-sitter-typescript.wasm',
    ),
    'node_modules/tree-sitter-typescript/typescript',
  ).pipe(
    Command.workingDirectory('./packages/core'),
    Command.stdout('inherit'),
    Command.stderr('inherit'),
    Command.exitCode,
  )

  yield* Command.make(
    'bunx',
    'tree-sitter',
    'build',
    '--wasm',
    '--output',
    path.resolve(
      import.meta.dirname,
      '../services/chunker-ast/tree-sitter-tsx.wasm',
    ),
    'node_modules/tree-sitter-typescript/tsx',
  ).pipe(
    Command.workingDirectory('./packages/core'),
    Command.stdout('inherit'),
    Command.stderr('inherit'),
    Command.exitCode,
  )
})

program.pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
