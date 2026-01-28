import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { ConfigLoaderError, MissingEnv } from './errors'
import { GrepAiConfig } from './config'

export class ConfigLoader extends Context.Tag(
  '@grepai/core/domain/config-loader/ConfigLoader',
)<
  ConfigLoader,
  {
    load: () => Effect.Effect<
      GrepAiConfig,
      ConfigLoaderError | MissingEnv,
      never
    >
  }
>() {}
