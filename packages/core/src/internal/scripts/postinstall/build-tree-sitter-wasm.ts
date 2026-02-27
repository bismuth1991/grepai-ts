import { Command, Path } from '@effect/platform'
import * as Effect from 'effect/Effect'

export const buildTreeSitterWasm = Effect.fnUntraced(function* () {
  const path = yield* Path.Path

  yield* Command.make(
    'bunx',
    'tree-sitter',
    'build',
    '--wasm',
    '--output',
    path.resolve(
      import.meta.dirname,
      '../../services/chunker-ast/tree-sitter-typescript.wasm',
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
      '../../services/chunker-ast/tree-sitter-tsx.wasm',
    ),
    'node_modules/tree-sitter-typescript/tsx',
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
      '../../services/chunker-ast/tree-sitter-json.wasm',
    ),
    'node_modules/tree-sitter-json',
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
      '../../services/chunker-ast/tree-sitter-javascript.wasm',
    ),
    'node_modules/tree-sitter-javascript',
  ).pipe(
    Command.workingDirectory('./packages/core'),
    Command.stdout('inherit'),
    Command.stderr('inherit'),
    Command.exitCode,
  )
})
