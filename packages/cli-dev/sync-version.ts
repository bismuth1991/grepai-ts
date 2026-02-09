import { FileSystem, Path } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as String from 'effect/String'

import { Version } from './src/version'

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const version = yield* Version

  const ROOT = path.resolve(import.meta.dirname, '../../')

  const PACKAGE_JSON_PATHS = [
    'packages/cli-dev/package.json',
    'releases/cli/package.json',
    'releases/cli-darwin-arm64/package.json',
    'releases/cli-linux-x64/package.json',
    'releases/cli-linux-x64-musl/package.json',
    'releases/cli-linux-arm64-musl/package.json',
  ]

  const CLI_PACKAGE = 'releases/cli/package.json'

  const updatePackageJsonVersion = Effect.fnUntraced(function* (
    filePath: string,
    newVersion: string,
  ) {
    const fullPath = path.join(ROOT, filePath)

    yield* fs.readFileString(fullPath).pipe(
      Effect.map(
        String.replace(
          /^(\s*"version"\s*:\s*")([^"]*)(")/m,
          `$1${newVersion}$3`,
        ),
      ),
      Effect.map((content) => {
        if (filePath === CLI_PACKAGE) {
          return String.replace(
            /(^\s*"@grepai\/cli-[^"]*"\s*:\s*")[^"]*(")/gm,
            `$1${newVersion}$2`,
          )(content)
        }
        return content
      }),
      Effect.andThen((newPackageJson) =>
        fs.writeFileString(fullPath, newPackageJson),
      ),
    )
  })

  const updatedVersion = yield* version.get()
  yield* Effect.forEach(PACKAGE_JSON_PATHS, (path) =>
    updatePackageJsonVersion(path, updatedVersion),
  )
})

program.pipe(
  Effect.provide(Version.Default.pipe(Layer.provideMerge(BunContext.layer))),
  BunRuntime.runMain,
)
