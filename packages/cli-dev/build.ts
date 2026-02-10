import { FileSystem, Path } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'

const build = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const RELEASE_DIR = path.resolve(import.meta.dirname, '../../releases/cli')

  yield* Effect.tryPromise({
    try: () =>
      Bun.build({
        entrypoints: ['./src/index.ts'],
        target: 'bun',
        format: 'esm',
        sourcemap: true,
        outdir: './dist',
        external: [
          '@libsql/darwin-arm64',
          '@libsql/darwin-x64',
          '@libsql/linux-arm64-gnu',
          '@libsql/linux-arm64-musl',
          '@libsql/linux-x64-gnu',
          '@libsql/linux-x64-musl',
          '@libsql/win32-x64-msvc',
        ],
      }),
    catch: (error) => {
      console.log(error)
    },
  })

  const indexFilePath = path.resolve(import.meta.dirname, './dist/index.js')

  yield* fs.readFileString(indexFilePath).pipe(
    Effect.flatMap((content) =>
      fs.writeFileString(indexFilePath, '#!/usr/bin/env bun\n' + content),
    ),
    Effect.andThen(fs.chmod(indexFilePath, 0o755)),
  )

  yield* fs.copy(path.resolve(import.meta.dirname, './dist/'), RELEASE_DIR, {
    overwrite: true,
  })

  yield* Effect.forEach(
    [
      '../core/node_modules/web-tree-sitter/web-tree-sitter.wasm',
      '../core/src/internal/services/chunker-ast/tree-sitter-tsx.wasm',
      '../core/src/internal/services/chunker-ast/tree-sitter-typescript.wasm',
    ],
    (wasmModule) =>
      fs.copyFile(
        path.resolve(import.meta.dirname, wasmModule),
        path.join(RELEASE_DIR, wasmModule.split('/').at(-1)!),
      ),
  )
})

build.pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
