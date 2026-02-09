import { FileSystem, Path } from '@effect/platform'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as String from 'effect/String'

class VersionFileNotFound extends Schema.TaggedError<VersionFileNotFound>()(
  'VersionFileNotFound',
  {},
) {}

export class Version extends Effect.Service<Version>()(
  '@grepai/cli-dev/version',
  {
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const ROOT = path.resolve(import.meta.dirname, '../../../')
      const VERSION_FILE = path.join(ROOT, 'VERSION')

      const get = Effect.fnUntraced(function* () {
        return yield* fs.readFileString(VERSION_FILE).pipe(
          Effect.map(String.trim),
          Effect.catchTags({
            BadArgument: () => new VersionFileNotFound(),
            SystemError: () => new VersionFileNotFound(),
          }),
        )
      })

      return {
        get,
      } as const
    }),
  },
) {}
