import { FileSystem, Path } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as String from 'effect/String'

class VersionFileNotFound extends Schema.TaggedError<VersionFileNotFound>()(
  'VersionFileNotFound',
  {},
) {}

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const ROOT = path.resolve(import.meta.dirname, '../../')
  const VERSION_FILE = path.join(ROOT, 'VERSION')

  const PACKAGE_JSON_PATHS = [
    'packages/cli-dev/package.json',
    'releases/cli/package.json',
  ]

  const CLI_INDEX_FILE = 'packages/cli-dev/src/index.ts'

  const getCurrentVersion = Effect.fnUntraced(function* () {
    return yield* fs.readFileString(VERSION_FILE).pipe(
      Effect.map(String.trim),
      Effect.catchTags({
        BadArgument: () => new VersionFileNotFound(),
        SystemError: () => new VersionFileNotFound(),
      }),
    )
  })

  const updateFileVersion = Effect.fnUntraced(function* (
    filePath: string,
    newVersion: string,
  ) {
    const fullPath = path.join(ROOT, filePath)

    yield* fs.readFileString(fullPath).pipe(
      // Update package.json
      Effect.map(
        String.replace(
          /^(\s*"version"\s*:\s*")([^"]*)(")/m,
          `$1${newVersion}$3`,
        ),
      ),
      Effect.map((content) => {
        // Update cli version
        if (filePath === CLI_INDEX_FILE) {
          return String.replace(
            /^(\s*version\s*:\s*')[^']*(')/m,
            `$1v${newVersion}$2`,
          )(content)
        }
        return content
      }),
      Effect.andThen((synced) => fs.writeFileString(fullPath, synced)),
    )
  })

  const version = yield* getCurrentVersion()
  yield* Effect.forEach([...PACKAGE_JSON_PATHS, CLI_INDEX_FILE], (path) =>
    updateFileVersion(path, version),
  )
})

program.pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
