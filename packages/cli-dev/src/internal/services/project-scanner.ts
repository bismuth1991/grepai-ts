import { FileSystem, Path } from '@effect/platform'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'

class ProjectNotFound extends Schema.TaggedError<ProjectNotFound>()(
  'ProjectNotFound',
  {},
) {}
class ProjectScannerError extends Schema.TaggedError<ProjectScannerError>()(
  'ProjectScannerError',
  { cause: Schema.Defect },
) {}

export class ProjectScanner extends Effect.Service<ProjectScanner>()(
  '@grepai/cli-dev/internal/services/config-scanner/ProjectScanner',
  {
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const cwd = process.cwd()

      const scan = Effect.fnUntraced(
        function* () {
          const hasDefault = yield* Effect.firstSuccessOf([
            fs.readFileString(
              path.resolve(cwd, `.grepai/.default.grepairc.json`),
            ),
            fs.readFileString(path.resolve(cwd, '.grepai/.grepairc.json')),
            fs.readFileString(path.resolve(cwd, '.grepairc.json')),
            fs.readFileString(path.resolve(cwd, 'grepai-config.json')),
          ]).pipe(
            Effect.zipRight(Effect.succeed(true)),
            Effect.catchAll(() => Effect.succeed(false)),
          )
          const projects = yield* fs.readDirectory('.grepai').pipe(
            Effect.map(Array.filter((file) => file.endsWith('.grepairc.json'))),
            Effect.map(
              Array.filterMap((file) =>
                Option.fromNullable(file.split('.').at(1)),
              ),
            ),
            Effect.flatMap((files) =>
              Effect.if(hasDefault, {
                onTrue: () => Effect.succeed([...files, 'default']),
                onFalse: () => Effect.succeed(files),
              }),
            ),
          )
          if (!projects.length) {
            return yield* new ProjectNotFound()
          }

          return projects
        },
        Effect.catchTags({
          BadArgument: (cause) => new ProjectScannerError({ cause }),
          SystemError: (cause) => new ProjectScannerError({ cause }),
        }),
      )

      return {
        scan,
      } as const
    }),
  },
) {}
