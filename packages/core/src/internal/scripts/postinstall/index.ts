import { BunContext, BunRuntime } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'

import { buildTreeSitterWasm } from './build-tree-sitter-wasm'
import { updateSubmodules } from './update-submodules'

const program = Effect.gen(function* () {
  yield* buildTreeSitterWasm()
  yield* updateSubmodules()
})

program.pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
