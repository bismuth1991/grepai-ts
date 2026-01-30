import { FileSystem, Path } from '@effect/platform'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import { Config, GrepAiConfig } from '../../domain/config'
import { ConfigLoaderError, MissingEnv } from '../../domain/errors'

export const ConfigJson = Layer.effect(
  Config,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const cwd = process.cwd()

    return yield* Effect.firstSuccessOf([
      fs.readFileString(path.resolve(cwd, 'grepai-config.json')),
      fs.readFileString(path.resolve(cwd, '.grepairc.json')),
    ]).pipe(
      Effect.flatMap(interpolateEnvVars),
      Effect.flatMap(Schema.decodeUnknown(Schema.parseJson(GrepAiConfig))),
      Effect.map((config) => ({
        ...config,
        cwd,
      })),
      Effect.catchTags({
        ParseError: (cause) => new ConfigLoaderError({ cause }),
        BadArgument: (cause) => new ConfigLoaderError({ cause }),
        SystemError: (cause) => new ConfigLoaderError({ cause }),
      }),
    )
  }),
)

function interpolateEnvVars(content: string) {
  return Effect.try({
    try: () =>
      content.replace(/\${(\w+)}/g, (_, key) => {
        const value = process.env[key]
        if (value === undefined) {
          throw new Error(key)
        }
        return value
      }),
    catch: (cause) =>
      cause instanceof Error
        ? new MissingEnv({ env: cause.message })
        : new ConfigLoaderError({ cause }),
  })
}
