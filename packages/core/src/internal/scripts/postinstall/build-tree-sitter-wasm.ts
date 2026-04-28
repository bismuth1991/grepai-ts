import { Command, Path } from '@effect/platform'
import * as Effect from 'effect/Effect'

const TREE_SITTER_WASM_BUILDS = [
  {
    output: 'tree-sitter-typescript.wasm',
    grammarPath: 'node_modules/tree-sitter-typescript/typescript',
  },
  {
    output: 'tree-sitter-yaml.wasm',
    grammarPath: 'node_modules/@tree-sitter-grammars/tree-sitter-yaml',
  },
  {
    output: 'tree-sitter-java.wasm',
    grammarPath: 'node_modules/tree-sitter-java',
  },
  {
    output: 'tree-sitter-tsx.wasm',
    grammarPath: 'node_modules/tree-sitter-typescript/tsx',
  },
  {
    output: 'tree-sitter-json.wasm',
    grammarPath: 'node_modules/tree-sitter-json',
  },
  {
    output: 'tree-sitter-javascript.wasm',
    grammarPath: 'node_modules/tree-sitter-javascript',
  },
  {
    output: 'tree-sitter-prisma.wasm',
    grammarPath: 'node_modules/tree-sitter-prisma',
  },
] as const

export const buildTreeSitterWasm = Effect.fnUntraced(function* () {
  const path = yield* Path.Path

  yield* Effect.forEach(
    TREE_SITTER_WASM_BUILDS,
    ({ output, grammarPath }) =>
      Command.make(
        'bunx',
        'tree-sitter',
        'build',
        '--wasm',
        '--output',
        path.resolve(import.meta.dirname, '../../services/chunker-ast', output),
        grammarPath,
      ).pipe(
        Command.workingDirectory('./packages/core'),
        Command.stdout('inherit'),
        Command.stderr('inherit'),
        Command.exitCode,
      ),
    { concurrency: 1 },
  )
})
