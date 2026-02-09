import { FileSystem, Path } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'

const build = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const isDarwinArm64 =
    process.platform === 'darwin' && process.arch === 'arm64'

  yield* Effect.tryPromise({
    try: () =>
      Bun.build({
        entrypoints: ['./src/index.ts'],
        format: 'cjs',
        sourcemap: true,
        bytecode: true,
        compile: {
          outfile: './dist/grepai',
        },
        minify: {
          syntax: true,
          whitespace: true,
        },
      }),
    catch: (error) => {
      console.log(error)
    },
  })

  if (isDarwinArm64) {
    yield* fs.copyFile(
      path.resolve(import.meta.dirname, './dist/grepai'),
      path.resolve(
        import.meta.dirname,
        '../../releases/cli-darwin-arm64/bin/grepai',
      ),
    )
  }
})

build.pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
