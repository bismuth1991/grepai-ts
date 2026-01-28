import { FileSystem } from '@effect/platform'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import { GrepAiConfig } from '../../domain/config'
import { ConfigLoader } from '../../domain/config-loader'
import { ConfigLoaderError, MissingEnv } from '../../domain/errors'

export const ConfigLoaderJson = Layer.effect(
  ConfigLoader,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    return ConfigLoader.of({
      load: () =>
        Effect.firstSuccessOf([
          fs.readFileString('grepai-config.json'),
          fs.readFileString('.grepairc.json'),
        ]).pipe(
          Effect.flatMap(interpolateEnvVars),
          Effect.flatMap(Schema.decodeUnknown(Schema.parseJson(GrepAiConfig))),
          Effect.catchTags({
            ParseError: (cause) => new ConfigLoaderError({ cause }),
            BadArgument: (cause) => new ConfigLoaderError({ cause }),
            SystemError: (cause) => new ConfigLoaderError({ cause }),
          }),
        ),
    })
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
