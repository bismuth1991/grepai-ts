import { FileSystem, Path } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'

const build = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  yield* Effect.tryPromise({
    try: () =>
      Bun.build({
        entrypoints: ['./src/index.ts'],
        target: 'bun',
        format: 'esm',
        sourcemap: true,
        outdir: './dist',
        naming: {
          asset: '[name].[ext]',
        },
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

  yield* fs.copy(
    path.resolve(import.meta.dirname, './dist/'),
    path.resolve(import.meta.dirname, '../../releases/cli'),
  )

  yield* fs.copyFile(
    path.resolve(
      import.meta.dirname,
      '../core/node_modules/web-tree-sitter/web-tree-sitter.wasm',
    ),
    path.resolve(
      import.meta.dirname,
      '../../releases/cli/web-tree-sitter.wasm',
    ),
  )
})

build.pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
