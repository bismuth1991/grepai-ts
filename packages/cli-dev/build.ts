import { FileSystem, Path } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'

const build = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const RELEASE_DIRS = [
    path.resolve(import.meta.dirname, '../../releases/cli'),
    path.resolve(import.meta.dirname, '../../releases/cli-darwin-x64'),
  ]

  yield* Effect.tryPromise({
    try: () =>
      Bun.build({
        entrypoints: ['./src/index.ts'],
        target: 'bun',
        format: 'esm',
        sourcemap: true,
        outdir: './dist',
        external: [
          '@lancedb/lancedb',
          '@libsql/darwin-arm64',
          '@libsql/darwin-x64',
          '@libsql/linux-arm64-gnu',
          '@libsql/linux-arm64-musl',
          '@libsql/linux-x64-gnu',
          '@libsql/linux-x64-musl',
          '@libsql/win32-x64-msvc',
          '@tursodatabase/sync',
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

  yield* Effect.forEach(RELEASE_DIRS, (releaseDir) =>
    fs.copy(path.resolve(import.meta.dirname, './dist/'), releaseDir, {
      overwrite: true,
    }),
  )

  yield* Effect.forEach(
    [
      '../core/node_modules/web-tree-sitter/web-tree-sitter.wasm',
      '../core/src/internal/services/chunker-ast/tree-sitter-tsx.wasm',
      '../core/src/internal/services/chunker-ast/tree-sitter-typescript.wasm',
      '../core/src/internal/services/chunker-ast/tree-sitter-javascript.wasm',
      '../core/src/internal/services/chunker-ast/tree-sitter-java.wasm',
      '../core/src/internal/services/chunker-ast/tree-sitter-json.wasm',
      '../core/src/internal/services/chunker-ast/tree-sitter-prisma.wasm',
    ],
    (wasmModule) =>
      Effect.forEach(RELEASE_DIRS, (releaseDir) =>
        fs.copyFile(
          path.resolve(import.meta.dirname, wasmModule),
          path.join(releaseDir, wasmModule.split('/').at(-1)!),
        ),
      ),
  )
})

build.pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
