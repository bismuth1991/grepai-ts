import { FileSystem } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem

  const TREE_SITTER_VERSION = '0.25.0'
  const PLATFORM = `${process.platform}-${process.arch}`
  const BASE_DIR = `node_modules/.bun/tree-sitter@${TREE_SITTER_VERSION}/node_modules/tree-sitter`
  const PREBUILD_DIR = `${BASE_DIR}/prebuilds/${PLATFORM}`

  yield* fs.makeDirectory(PREBUILD_DIR, {
    recursive: true,
  })

  yield* fs.copyFile(
    `${BASE_DIR}/build/Release/tree_sitter_runtime_binding.node`,
    `${PREBUILD_DIR}/tree-sitter.node`,
  )
})

program.pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
